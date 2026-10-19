import { test, expect } from "@playwright/test";
import { freshData, validateData, summary, dateKey } from "../src/domain";
import type { AppData, Task, Transaction, WalletAccount } from "../src/domain";
import { accountBalance, categorySpending, monthlyReport, quickExpenses } from "../src/finance-tools";
import { materializeRecurrences, repeatingTask, repeatingTransaction } from "../src/planning";
import { encryptBackup, decryptBackup } from "../src/backup-crypto";
const account: WalletAccount={id:"bank",name:"Bank",kind:"bank",openingCents:100000,openingDate:"2026-10-01"};
const entry=(id:string,amountCents:number,type:Transaction["type"]="expense",paid=true,date="2026-10-10"):Transaction=>({id,description:id,amountCents,type,paid,date,category:type==="expense"?"Alimentação":"Salário",notes:"",accountId:"bank"});
const task=(id:string):Task=>({id,title:id,date:"2026-10-19",time:"",category:"Pessoal",priority:"Média",notes:"",completed:false});
test("wallet balances use opening dates, confirmed transactions and transfers; internal transfers conserve the total",()=>{
 const data:AppData={...freshData(),accounts:[account,{...account,id:"cash",name:"Cash",kind:"cash",openingCents:0}],transactions:[entry("salary",200000,"income"),entry("food",12345),entry("planned",9900,"expense",false),entry("future",800,"expense",true,"2026-11-01"),{...entry("legacy",1000),accountId:undefined}],transfers:[{id:"transfer",fromAccountId:"bank",toAccountId:"cash",amountCents:50000,date:"2026-10-11",notes:""}]};
 const original=JSON.stringify(data),valid=validateData(data);
 expect(accountBalance(valid,valid.accounts![0],"2026-10-19")).toBe(237655);
 expect(accountBalance(valid,valid.accounts![1],"2026-10-19")).toBe(50000);
 expect(valid.accounts!.reduce((sum,a)=>sum+accountBalance(valid,a,"2026-10-19"),0)).toBe(287655);
 expect(accountBalance(valid,account,"2026-09-30")).toBe(0);
 expect(summary(valid.transactions,"2026-10")).toMatchObject({income:200000,expense:13345,pending:9900});
 expect(JSON.stringify(data)).toBe(original);
});
test("version 1 backups are unchanged; account, category, transfer and subtask references are validated",()=>{
 expect(validateData(freshData())).toEqual(freshData());
 const data:AppData={...freshData(),accounts:[account],transactions:[entry("food",1)],tasks:[{...task("task"),subtasks:[{id:"child",title:"Step",completed:false}],focusDate:"2026-10-19"}],categoryBudgets:{"2026-10":{Alimentação:10000}}};
 expect(validateData(data)).toEqual(data);
 for(const bad of [{accounts:[{...account,openingCents:NaN}]},{accounts:[{...account,id:"food"}]},{transactions:[{...entry("x",1),accountId:"unknown"}]},{transactions:[entry("x",1,"expense",true,"2026-09-30")]},{categoryBudgets:{"2026-10":{Unknown:1}}},{categoryBudgets:{"2026-10":{Alimentação:0}}},{categoryBudgets:{"2026-13":{Alimentação:1}}},{tasks:[{...task("x"),subtasks:[{id:"a",title:"A",completed:"yes"}]}]},{tasks:[{...task("x"),subtasks:[{id:"a",title:"A",completed:false},{id:"a",title:"B",completed:true}]}]},{tasks:[0,1,2,3].map(i=>({...task(String(i)),focusDate:"2026-10-19"}))}]) expect(()=>validateData({...data,...bad})).toThrow();
 const transfer={id:"transfer",fromAccountId:"bank",toAccountId:"bank",amountCents:1,date:"2026-10-19",notes:""};expect(()=>validateData({...data,transfers:[transfer]})).toThrow();
 expect(validateData({...data,accounts:[{...account,injected:true}]}).accounts![0]).not.toHaveProperty("injected");
});
test("category limits count paid and planned installments and use exact 80/100 percent thresholds",()=>{
 const data:AppData={...freshData(),transactions:[entry("paid",7999),entry("planned",1,"expense",false)],categoryBudgets:{"2026-10":{Alimentação:10000}}};
 expect(categorySpending(data,"2026-10")[0]).toMatchObject({spent:8000,paid:7999,percent:80,remaining:2000});
 expect(categorySpending({...data,transactions:[entry("paid",7999)]},"2026-10")[0].percent).toBe(79);
 expect(categorySpending({...data,transactions:[entry("paid",10001)]},"2026-10")[0]).toMatchObject({percent:100,remaining:-1});
 expect(categorySpending(data,"2026-11")[0].limit).toBeUndefined();
});
test("monthly reports compare years, avoid invented percentages and separate planned spending from confirmed results",()=>{
 const data:AppData={...freshData(),transactions:[entry("previous",10000,"expense",true,"2025-12-10"),entry("expense",7000,"expense",true,"2026-01-10"),entry("income",20000,"income",true,"2026-01-10"),entry("planned",8000,"expense",false,"2026-01-11")],categoryBudgets:{"2026-01":{Alimentação:10000}}};
 expect(monthlyReport(data,"2026-01")).toMatchObject({hasPrevious:true,expenseChange:-3000,changePercent:-30,current:{income:20000,expense:7000,balance:13000}});
 expect(monthlyReport(data,"2026-01").exceeded[0].spent).toBe(15000);
 expect(monthlyReport(data,"2026-01").top.map(t=>t.id)).toEqual(["expense"]);
 expect(monthlyReport(data,"2026-02").changePercent).toBe(-100);
 expect(monthlyReport(freshData(),"2026-01")).toMatchObject({hasPrevious:false,changePercent:null});
});
test("recurrences retain account references, reset future subtask completion and never copy daily focus",()=>{
 const data={...freshData(),accounts:[account]};
 const routine=repeatingTransaction(data,entry("expense",100),"monthly","2026-10-19");expect(validateData(routine).recurrences![0].template).toHaveProperty("accountId","bank");
 const tasks=repeatingTask(freshData(),{...task("task"),focusDate:"2026-10-19",subtasks:[{id:"child",title:"Step",completed:true}]},"daily","2026-10-19");
 expect(validateData(tasks).tasks[1].subtasks![0].completed).toBe(false);expect(tasks.tasks[1].focusDate).toBeUndefined();
 expect(materializeRecurrences(tasks,"2026-10-19")).toBe(tasks);
});
test("quick expense templates rank frequency, preserve cents and do not mutate or include card installments",()=>{
 const items=[entry("Coffee",1234),{...entry("second",1200),description:"Coffee"},entry("Rent",50000),{...entry("card",500),installment:{cardId:"c",purchaseId:"p",index:1,count:1,purchasedOn:dateKey()}}];
 expect(quickExpenses(items)[0].description).toBe("Coffee");expect(quickExpenses(items).some(t=>t.id==="card")).toBe(false);expect(items).toHaveLength(4);
});
test("encrypted backups authenticate content, use fresh nonces, handle Unicode, and reject altered metadata or wrong passwords",async()=>{
 test.setTimeout(90000);
 const password="Personal-test-password-123",text=JSON.stringify({...freshData(),name:"João 😀"});
 const one=await encryptBackup(text,password),two=await encryptBackup(text,password);
 expect(one.salt).not.toBe(two.salt);expect(one.iv).not.toBe(two.iv);expect(JSON.stringify(one)).not.toContain("João");
 expect(await decryptBackup(one,password)).toBe(text);
 await expect(decryptBackup(one,"different-password-123")).rejects.toThrow();
 const changed=one.ciphertext.slice(0,-8)+(one.ciphertext.slice(-8,-7)==="A"?"B":"A")+one.ciphertext.slice(-7);
 await expect(decryptBackup({...one,ciphertext:changed},password)).rejects.toThrow();
 await expect(decryptBackup({...one,iterations:1_000_000_000},password)).rejects.toThrow();
 await expect(encryptBackup(text,"short")).rejects.toThrow();
});
