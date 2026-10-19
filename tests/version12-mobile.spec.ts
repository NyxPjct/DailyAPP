import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshData, validateData } from "../src/domain";
import type { AppData, Task, Transaction } from "../src/domain";
import { LANGUAGES, translate } from "../src/i18n/core";
import { currencyForLanguage, ratesFromResponse } from "../src/currency";
import { nativeBridge } from "./helpers/native";

const rates=ratesFromResponse({date:"2026-10-19",brl:{brl:1,usd:0.2,eur:0.18,gbp:0.15,cad:0.28,aud:0.3}},new Date("2026-10-19T15:00:00Z"));
const task=(id:string):Task=>({id,title:`Task ${id}`,date:"2026-10-19",time:"",category:"Pessoal",priority:"Média",completed:false,notes:""});
const entry=(id:string,amountCents:number,paid=true,date="2026-10-19"):Transaction=>({id,description:id,amountCents,type:"expense",paid,date,category:"Alimentação",notes:""});
const base:AppData={...freshData(),language:"en",currency:"BRL",exchangeRates:rates,tasks:[1,2,3,4].map(n=>task(String(n))),transactions:[entry("Food",8000,false),entry("Coffee",1000),entry("September",20000,true,"2026-09-19")],accounts:[{id:"bank",name:"Bank",kind:"bank",openingCents:100000,openingDate:"2026-10-01"},{id:"cash",name:"Cash",kind:"cash",openingCents:10000,openingDate:"2026-10-01"}]};
const saved=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem("dailyapp.v1")!) as AppData);
async function start(page:Page,data=base){await nativeBridge(page,"android");await page.setViewportSize({width:390,height:844});await page.clock.setFixedTime(new Date("2026-10-19T15:00:00Z"));await page.addInitScript(data=>{if(!localStorage.getItem("dailyapp.v1"))localStorage.setItem("dailyapp.v1",JSON.stringify(data));},data);await page.goto("http://127.0.0.1:5176",{waitUntil:"networkidle"});}
async function finance(page:Page,tab:string){await page.getByRole("button",{name:"My finances",exact:true}).click();await page.getByRole("group",{name:"Financial view"}).getByRole("button",{name:tab,exact:true}).click();}

test("accounts and transfers preserve legacy records and affect balances without duplicating income or expenses",async({page})=>{
 await start(page);await finance(page,"Accounts");
 await expect(page.getByRole("article",{name:"Account Bank",exact:true})).toContainText("R$1,000.00");
 await page.getByRole("button",{name:"New transfer",exact:true}).click();
 await page.getByLabel("Source account",{exact:true}).selectOption("bank");await page.getByLabel("Destination account",{exact:true}).selectOption("cash");await page.getByLabel("Transfer amount (R$)").fill("200.00");await page.getByRole("button",{name:"Save transfer",exact:true}).click();
 await expect(page.getByRole("article",{name:"Account Bank",exact:true})).toContainText("R$800.00");await expect(page.getByRole("article",{name:"Account Cash",exact:true})).toContainText("R$300.00");expect((await saved(page)).transactions).toEqual(base.transactions);
 await finance(page,"Overview");await page.getByRole("button",{name:"Edit transaction: Food",exact:true}).click();await page.getByLabel("Transaction account",{exact:true}).selectOption("bank");await page.getByRole("checkbox",{name:translate("en","Esta despesa já foi paga"),exact:false}).check();await page.getByRole("dialog").getByRole("button",{name:"Save changes",exact:true}).click();
 await finance(page,"Accounts");await expect(page.getByRole("article",{name:"Account Bank",exact:true})).toContainText("R$720.00");
 const id=(await saved(page)).transfers![0].id;await page.getByRole("button",{name:`Edit transfer: ${id}`,exact:true}).click();await page.getByLabel("Transfer amount (R$)").fill("250.00");await page.getByRole("button",{name:"Save transfer",exact:true}).click();await expect(page.getByRole("article",{name:"Account Bank",exact:true})).toContainText("R$670.00");
 await page.getByRole("button",{name:`Delete transfer: ${id}`,exact:true}).click();await page.getByRole("button",{name:"Confirm",exact:true}).click();await expect(page.getByRole("article",{name:"Account Bank",exact:true})).toContainText("R$920.00");expect((await saved(page)).transfers).toEqual([]);
 await page.getByRole("article",{name:"Account Cash",exact:true}).getByRole("button",{name:"Archive account",exact:true}).click();await page.getByRole("button",{name:"Confirm",exact:true}).click();await expect(page.getByRole("article",{name:"Account Cash",exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Show archived",exact:true}).click();await expect(page.getByRole("article",{name:"Account Cash",exact:true})).toBeVisible();
 await page.reload();expect((await saved(page)).accounts![1].archived).toBe(true);
});

test("new account, category budgets, threshold warnings and monthly reports work together",async({page})=>{
 await start(page);await finance(page,"Accounts");await page.getByRole("button",{name:"New account",exact:true}).click();await page.getByLabel("Account name",{exact:true}).fill("Savings");await page.getByLabel("Account type",{exact:true}).selectOption("savings");await page.getByLabel("Opening balance (R$)").fill("-50.00");await page.getByRole("button",{name:"Save account",exact:true}).click();expect((await saved(page)).accounts!.find(a=>a.name==="Savings")?.openingCents).toBe(-5000);
 await finance(page,"Planning");await page.getByRole("button",{name:"Set limits",exact:true}).click();await page.getByLabel("Food (R$)",{exact:true}).fill("100.00");await page.getByRole("button",{name:"Save limits",exact:true}).click();
 const food=page.getByRole("article",{name:"Limit for Food",exact:true});await expect(food).toContainText("R$90.00");await expect(food).toContainText("at least 80%");expect(await food.locator(".progress-track > span").evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(0);expect((await saved(page)).categoryBudgets).toEqual({"2026-10":{Alimentação:10000}});
 await finance(page,"Report");await expect(page.locator(".monthly-report")).toContainText("R$10.00");await expect(page.locator(".monthly-report")).toContainText("You spent R$190.00 less.");await expect(page.locator(".monthly-report")).toContainText("Coffee");await expect(page.locator(".monthly-report")).not.toContainText("R$80.00");
 await finance(page,"Planning");await page.getByRole("button",{name:"Set limits",exact:true}).click();await page.getByLabel("Food (R$)",{exact:true}).fill("80.00");await page.getByRole("button",{name:"Save limits",exact:true}).click();await expect(food).toContainText("Limit reached or exceeded");
 await finance(page,"Report");await expect(page.locator(".monthly-report")).toContainText("R$10.00 over");
});

test("quick expenses create a reviewed new record, and task steps and three daily priorities persist",async({page})=>{
 await start(page);await finance(page,"Overview");await page.locator(".quick-expenses").getByRole("button",{name:/Coffee/}).click();expect((await saved(page)).transactions).toHaveLength(3);await expect(page.getByLabel("Amount (R$)",{exact:true})).toHaveValue("10.00");await page.getByRole("dialog").getByRole("button",{name:"Record transaction",exact:true}).click();expect((await saved(page)).transactions).toHaveLength(4);
 await page.getByRole("button",{name:"My tasks",exact:true}).click();await page.getByRole("button",{name:"Edit task: Task 1",exact:true}).click();await page.getByLabel("New step",{exact:true}).fill("Book hotel");await page.getByLabel("New step",{exact:true}).press("Enter");await expect(page.getByRole("dialog")).toBeVisible();await page.getByRole("checkbox",{name:"Complete step: Book hotel",exact:true}).check();await page.getByRole("button",{name:"Save changes",exact:true}).click();expect((await saved(page)).tasks[0].subtasks![0].completed).toBe(true);expect((await saved(page)).tasks[0].completed).toBe(false);
 for(const id of [1,2,3,4])await page.getByRole("button",{name:`Prioritize today: Task ${id}`,exact:true}).click();expect((await saved(page)).tasks.filter(t=>t.focusDate==="2026-10-19")).toHaveLength(3);await expect(page.getByRole("status")).toContainText("at most three priorities");
 await page.getByRole("navigation",{name:"App navigation"}).getByRole("button",{name:"Overview",exact:true}).click();await page.getByRole("checkbox",{name:"Complete priority: Task 1",exact:true}).check();expect((await saved(page)).tasks[0].completed).toBe(true);await page.reload();expect((await saved(page)).tasks[0].subtasks![0].title).toBe("Book hotel");
});

test("password backup stays encrypted and wrong passwords or a canceled preview never replace current data",async({page})=>{
 test.setTimeout(90000);await page.addInitScript(()=>Object.defineProperty(crypto,"subtle",{value:undefined}));await start(page);await page.getByRole("button",{name:"Settings",exact:true}).click();await page.getByRole("button",{name:"Password-protected backup",exact:true}).click();const password="My-personal-demo-pass-123";
 await page.getByLabel("Backup password",{exact:true}).fill(password);await page.getByLabel("Confirm password",{exact:true}).fill(password);await page.getByRole("button",{name:"Export with password",exact:true}).click();await expect(page.getByRole("status")).toContainText("Protected backup ready");
 const encrypted=await page.evaluate(()=>(window as any).dailyappNativeTest.calls.find((c:any)=>c.method==="writeFile").options.data);expect(JSON.parse(encrypted).format).toBe("dailyapp-encrypted");expect(encrypted).not.toContain('"accounts":');
 await page.getByLabel("Your name",{exact:true}).fill("Keep until confirmed");await page.getByRole("button",{name:"Save name",exact:true}).click();const before=await saved(page);
 const upload=()=>page.getByLabel("Backup file").setInputFiles({name:"protected.json",mimeType:"application/json",buffer:Buffer.from(encrypted)});await upload();await page.getByLabel("Backup password",{exact:true}).fill("wrong-password-123");await page.getByRole("button",{name:"Unlock and review",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Incorrect password");expect(await saved(page)).toEqual(before);
 await page.getByLabel("Backup password",{exact:true}).fill(password);await page.getByRole("button",{name:"Unlock and review",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("2 accounts");expect(await saved(page)).toEqual(before);await page.getByRole("button",{name:"Cancel",exact:true}).click();expect(await saved(page)).toEqual(before);
 await upload();await page.getByLabel("Backup password",{exact:true}).fill(password);await page.getByRole("button",{name:"Unlock and review",exact:true}).click();await page.getByRole("button",{name:"Confirm",exact:true}).click();expect((await saved(page)).name).toBe("");expect(validateData(await saved(page)).accounts).toEqual(base.accounts);
});

for(const language of LANGUAGES)test(`${language.name}: all version 1.2 screens translate and stay usable at 320px offline`,async({page})=>{
 const tr=(s:string,...v:unknown[])=>translate(language.id,s,...v);await start(page,{...base,language:language.id,currency:currencyForLanguage(language.id),categoryBudgets:{"2026-10":{Alimentação:10000}}});await page.context().setOffline(true);await page.setViewportSize({width:320,height:740});
 await page.getByRole("button",{name:tr("Minhas finanças"),exact:true}).click();await page.getByRole("button",{name:tr("Contas"),exact:true}).click();await expect(page.getByRole("heading",{name:tr("Contas e carteiras"),exact:true})).toBeVisible();await page.getByRole("button",{name:tr("Nova conta"),exact:true}).click();await expect(page.getByLabel(tr("Nome da conta"),{exact:true})).toBeVisible();await page.getByRole("button",{name:tr("Cancelar"),exact:true}).click();
 await page.getByRole("button",{name:tr("Relatório"),exact:true}).click();await expect(page.getByRole("heading",{name:tr("Relatório mensal"),exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
 await page.getByRole("button",{name:tr("Planejamento"),exact:true}).click();await expect(page.getByRole("heading",{name:tr("Orçamento por categoria"),exact:true})).toBeVisible();await page.getByRole("button",{name:tr("Definir limites"),exact:true}).click();await expect(page.getByRole("button",{name:tr("Salvar limites"),exact:true})).toBeVisible();await page.getByRole("button",{name:tr("Cancelar"),exact:true}).click();
 await page.getByRole("button",{name:tr("Minhas tarefas"),exact:true}).click();await page.getByRole("button",{name:tr("Editar tarefa: {0}","Task 1"),exact:true}).click();await expect(page.getByRole("group",{name:tr("Subtarefas"),exact:true})).toBeVisible();await page.getByRole("button",{name:tr("Cancelar"),exact:true}).click();
 await page.getByRole("button",{name:tr("Configurações"),exact:true}).click();await page.getByRole("button",{name:tr("Backup com senha"),exact:true}).click();await expect(page.getByLabel(tr("Senha do backup"),{exact:true})).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
});

test("paying a card bill debits its chosen account once and preserves the accounts of installments already paid",async({page})=>{
 const card={id:"card",name:"Card",limitCents:500000,closingDay:10,dueDay:19,paymentAccountId:"bank"};
 const part={...entry("Installment",10000,false),installment:{cardId:"card",purchaseId:"purchase",index:1,count:2,purchasedOn:"2026-10-01"}};
 const future={...part,id:"future",date:"2026-11-19",installment:{...part.installment,index:2}};
 const paid={...entry("Already paid",5000),accountId:"cash",installment:{cardId:"card",purchaseId:"old",index:1,count:1,purchasedOn:"2026-10-01"}};
 await start(page,{...base,cards:[card],transactions:[part,future,paid]});await finance(page,"Cards and installments");await page.getByRole("button",{name:"Mark bill as paid",exact:true}).click();await page.getByRole("button",{name:"Confirm",exact:true}).click();const data=await saved(page);expect(data.transactions).toHaveLength(3);expect(data.transactions[0]).toMatchObject({accountId:"bank",paid:true});expect(data.transactions[1].paid).toBe(false);expect(data.transactions[2].accountId).toBe("cash");
 await finance(page,"Accounts");await expect(page.getByRole("article",{name:"Account Bank",exact:true})).toContainText("R$900.00");await expect(page.getByRole("article",{name:"Account Cash",exact:true})).toContainText("R$50.00");
});
