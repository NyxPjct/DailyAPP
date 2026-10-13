# DailyAPP 1.1 — uso pessoal

## Downloads

- **Android:** [Baixar APK 1.1](https://github.com/NyxPjct/DailyAPP/releases/download/personal-v1.1.0-r1/DailyAPP-1.1-pessoal.apk) — abra o arquivo no celular para instalar. Requer Android 7 ou superior.
- **iPhone:** [Baixar IPA 1.1 sem assinatura](https://github.com/NyxPjct/DailyAPP/releases/download/personal-v1.1.0-r1/DailyAPP-1.1-sem-assinatura.ipa) — requer iOS 15.4 ou superior e assinatura pessoal antes de instalar. No Windows, siga [as instruções com AltServer/AltStore](docs/CELULAR.md#iphone-sem-mac-pessoal). O IPA não instala sozinho ao ser aberto.

- **Computador:** [Baixar prévia com index.html](https://github.com/NyxPjct/DailyAPP/releases/download/personal-v1.1.0-r1/DailyAPP-index.zip) — extraia o ZIP e abra `index.html` no Chrome ou Edge.

[Abrir a Release com os arquivos e hashes SHA-256](https://github.com/NyxPjct/DailyAPP/releases/tag/personal-v1.1.0-r1). Os três downloads foram baixados e conferidos após a publicação.

Se já instalou o DailyAPP no Android, exporte um backup em Ajustes e instale o novo APK sem desinstalar o aplicativo. [Conferir SHA-256 do APK](downloads/DailyAPP-1.1-pessoal.apk.sha256).

**Atualização da 1.1:** esta revisão mantém a versão 1.1.0, agora com compilação 4, e acrescenta contas na tela Hoje, metas financeiras e previsão de saldo. O [guia de cada função](#o-que-cada-função-faz) está abaixo.

Aplicativo de tarefas, agenda e finanças pessoais em português. A interface React é empacotada com Capacitor em aplicativos instalados no celular. As telas, fontes e ícones fazem parte da instalação; o funcionamento local dispensa hospedagem, Netlify e Supabase.

Os pacotes Android e iPhone estão na Release acima. O IPA foi compilado com Xcode 26.3 no Mac do GitHub Actions e não inclui assinatura pessoal da Apple. Consulte [Instalar e compilar no celular](docs/CELULAR.md).

Para abrir a interface de celular diretamente no computador, gere `artifacts/index.html` com `npm run preview:computer`. Esse arquivo inclui scripts, estilos, ícones e fontes: baixe-o e abra no Chrome ou Edge. Não é necessário iniciar servidor ou instalar ferramentas no computador que abre o arquivo. Os registros dessa demonstração ficam no navegador; use backups para transferi-los ao aplicativo.

## Capturas do aplicativo

| Hoje | Tarefas | Finanças |
| --- | --- | --- |
| <img src="docs/screenshots/hoje.png" alt="DailyAPP: resumo do dia, tarefas e saldo do mês" width="250"> | <img src="docs/screenshots/tarefas.png" alt="DailyAPP: lista de tarefas com horários e categorias" width="250"> | <img src="docs/screenshots/financas.png" alt="DailyAPP: receitas, despesas, saldo e gráfico de gastos por categoria" width="250"> |

Capturas da interface móvel em viewport de 390 × 900, com dados fictícios de **Explorar exemplo**, renderizadas no Chromium. Para atualizar as três imagens, execute `npm run screenshots` após instalar as dependências e o navegador Playwright.

## Funcionalidades

- Barra inferior com Hoje, Agenda, Tarefas, Finanças e Ajustes.
- Primeiro uso com nome e orçamento opcionais, e guia rápido em Ajustes.
- Cadastro, edição, conclusão e exclusão de tarefas com data, horário, categoria e prioridade.
- Calendário mensal e tarefas do dia selecionado.
- Tela Hoje com contas, recebimentos e parcelas pendentes, incluindo atrasos e os próximos sete dias.
- Receitas, despesas, valores pagos ou previstos, histórico, categorias e orçamento mensal.
- Tarefas e movimentações recorrentes, com repetição diária, semanal, mensal ou anual e histórico preservado ao encerrar a rotina.
- Cartões, limite disponível, fechamento, vencimento e compras em até 48 parcelas com centavos exatos.
- Faturas mensais que atualizam as parcelas ao marcar o pagamento, sem duplicar despesas.
- Metas com valor desejado, prazo, progresso e sugestão mensal para alcançar o objetivo.
- Previsão do saldo ao fim do mês e por dia, com saldo inicial manual e aviso de saldo negativo.
- Lembretes locais de tarefas, contas e faturas, com permissão do celular; avisos são atualizados ao concluir, pagar ou editar.
- Dados salvos no próprio dispositivo, sem exigir conta ou conexão com a internet.
- Exportação de backup JSON pelo compartilhamento do Android/iPhone e importação pelo seletor de arquivos.
- Botão voltar do Android fecha formulários e retorna ao início antes de minimizar o aplicativo.
- Layout adaptado às áreas seguras da tela e ícones próprios para as duas plataformas.

O saldo considera receitas recebidas e despesas pagas no mês. O orçamento inclui despesas pagas e previstas. Os cálculos usam centavos inteiros. Há dados fictícios opcionais em **Explorar exemplo**.

## O que cada função faz

### Hoje

| Função | Para que serve e como usar |
| --- | --- |
| Resumo do mês | Mostra receitas recebidas, despesas pagas e a diferença entre elas no mês escolhido. Esse **saldo do mês** não inclui dinheiro que você já tinha antes do mês. Use as setas para mudar o período. |
| Tarefas de hoje | Lista as tarefas do dia, horários e progresso. Toque no círculo para concluir ou desfazer a conclusão; **Ver todas** abre o filtro Hoje em Tarefas. |
| Tarefas anteriores | Avisa sobre tarefas pendentes de dias anteriores e abre o filtro Atrasadas. |
| Contas e recebimentos | Reúne movimentações pendentes de dias anteriores, de hoje e dos próximos sete dias, incluindo parcelas e registros recorrentes. Esse período acompanha a data atual, independentemente do mês escolhido no resumo. Toque na descrição para editar; **Pagar** ou **Receber** confirma o registro existente, sem criar outro. Para desfazer, abra a movimentação em Finanças e volte o status para Prevista. |
| Dinheiro em movimento | Gráfico das receitas recebidas e despesas pagas acumuladas no mês. **Ver detalhes** abre Finanças. |
| Gastos por categoria | Mostra como as despesas pagas e previstas se distribuem entre alimentação, moradia, transporte e outras categorias. |
| Metas e previsão do mês | Abre **Finanças → Planejamento** no mês atual. |

### Agenda e Tarefas

| Função | Para que serve e como usar |
| --- | --- |
| Calendário | Navegue entre meses e toque em uma data para ver suas tarefas. **Hoje** volta ao dia atual. O calendário lista tarefas; contas e parcelas aparecem na tela Hoje e em Finanças. |
| Nova tarefa | Registre título, data, horário opcional, categoria, prioridade e observações. Ao criar pela Agenda, a data selecionada já vem preenchida. |
| Editar e excluir | Toque na tarefa ou no lápis para editar. A lixeira solicita confirmação antes de remover. |
| Concluir | O círculo marca a tarefa como concluída; tocar novamente a deixa pendente. O progresso de Hoje acompanha essa mudança. |
| Busca e filtros | Busque por título, categoria ou observações. Use Todas, Hoje, Pendentes, Concluídas e Atrasadas para encontrar o que precisa. |
| Repetir tarefa | Gera uma rotina diária, semanal, mensal ou anual. As próximas tarefas começam pendentes. Em meses curtos, ajusta o dia e preserva a referência original para os meses seguintes. |
| Rotinas recorrentes | Mostra as rotinas ativas. **Parar repetição** remove somente ocorrências futuras ainda pendentes; mantém registros anteriores, de hoje e já concluídos. Editar muda apenas a ocorrência escolhida. Excluir uma ocorrência não a recria ao abrir o app. |

### Finanças → Resumo

| Função | Para que serve e como usar |
| --- | --- |
| Nova movimentação | Registre uma receita ou despesa com descrição, valor, data, categoria e observações. Selecione se já foi recebida/paga ou se continua prevista. |
| Receitas, despesas e saldo | Receitas e despesas confirmadas compõem o resultado do mês. **A pagar** soma as despesas previstas do período, incluindo parcelas. |
| Status Paga, Recebida ou Prevista | Toque no status para confirmar ou desfazer o pagamento/recebimento. O registro é atualizado; nenhum lançamento adicional é criado. |
| Histórico, busca e filtros | Consulte movimentações do mês selecionado. Filtre por receita/despesa e por Efetivadas/Previstas; busque por descrição, categoria ou observações. |
| Orçamento mensal | Defina um limite de gastos para o mês. A barra considera despesas pagas **e previstas**, incluindo parcelas. Cada mês tem seu próprio orçamento; o saldo inicial da previsão é uma configuração separada. |
| Despesas por categoria | Compara o total de gastos pagos e previstos de cada categoria. |
| Repetir movimentação | Prepara receitas e contas fixas com frequência diária, semanal, mensal ou anual. Futuras ocorrências começam previstas e precisam de confirmação manual. |
| Editar e excluir | O lápis altera a movimentação e a lixeira solicita confirmação. Em compras parceladas, excluir uma parcela remove **toda a compra e suas parcelas, inclusive as pagas**; a confirmação explica isso. |

### Finanças → Cartões e parcelas

| Função | Para que serve e como usar |
| --- | --- |
| Novo cartão | Informe um nome, limite e dias de fechamento/vencimento. O app não pede número, senha ou código de segurança do cartão. |
| Registrar compra | Informe o valor **total** e de 1 a 48 parcelas. O app divide os centavos sem perder o total e cria cada parcela como despesa prevista na sua data de vencimento. Não registre a mesma compra novamente em Nova movimentação. |
| Fechamento e vencimento | Compras no dia de fechamento ou depois entram no ciclo seguinte. Dias 29, 30 e 31 são ajustados nos meses menores. Alterar os dias do cartão afeta somente compras novas. |
| Fatura mensal | Mostra as parcelas do cartão no mês escolhido e quanto falta pagar. **Marcar fatura como paga** confirma essas parcelas; não cria outra despesa. |
| Limite disponível | Estima o limite menos todas as parcelas ainda não pagas, inclusive futuras. Não consulta o banco e não representa um limite aprovado por ele. |
| Arquivar e reativar | Arquivar impede compras novas, preservando parcelas, faturas e registros anteriores. Reativar permite novas compras. |

### Finanças → Planejamento

| Função | Para que serve e como usar |
| --- | --- |
| Saldo inicial do mês | Informe o dinheiro disponível **antes da primeira movimentação daquele mês**. Aceita zero ou valor negativo. Não use o saldo atual que já inclui movimentações cadastradas. Cada mês é informado separadamente; não há transferência automática do saldo entre meses. |
| Previsão de saldo | Calcula **saldo inicial + receitas − despesas do mês**, confirmadas e previstas. Cada parcela entra uma vez no mês do seu vencimento. Marcar o pagamento troca o status, mantendo o mesmo valor projetado. A previsão só é exibida depois de informar o saldo inicial. |
| Evolução por dia | Mostra o saldo previsto ao fim de cada data com movimentações e o menor saldo diário. Um aviso destaca quando a estimativa fica negativa. A ordem dos pagamentos dentro de um mesmo dia não é simulada. |
| Contas de meses anteriores | Aparecem como aviso e na tela Hoje; não são descontadas novamente em outro mês. Se forem pagas no mês atual, ajuste a data do registro para esse mês. |
| Nova meta | Defina nome, valor desejado, prazo, observações e quanto já guardou. Serve para reserva de emergência, viagem, compra ou outro objetivo. |
| Atualizar meta | Informe o **total já guardado**, em vez de apenas o último depósito. O app mostra percentual, valor que falta e sugestão mensal até o prazo, contando o mês atual. A meta fica Concluída ao alcançar o valor; se o prazo passar antes disso, indica Prazo vencido. |
| Arquivar, reativar e excluir meta | Arquivar esconde a meta e preserva seus dados; **Mostrar arquivadas** permite reativá-la. Excluir exige confirmação e remove a meta e seu progresso. |

A previsão depende das datas e valores cadastrados e não consulta bancos. Metas são acompanhamento manual: não transferem dinheiro, não reservam saldo e não criam receitas/despesas automaticamente. Se houver um gasto ou recebimento real, registre-o em Finanças.

### Lembretes

Escolha a antecedência ao criar/editar uma tarefa, movimentação ou cartão e permita notificações no celular. Tarefas precisam de horário; contas e faturas avisam às **9h locais**. Ao concluir, pagar, alterar ou excluir um registro, os avisos futuros são atualizados. O sistema pode atrasar avisos para economizar bateria; avisos atrasados ainda válidos são preservados.

O app prepara até **60 avisos próximos** e os renova ao abrir ou retomar. As rotinas preparam até **90 dias de tarefas e 12 meses de movimentações**, ampliando esse período ao voltar ao app. Não há confirmação automática de tarefas ou pagamentos. Na prévia do computador, as preferências são salvas, mas notificações nativas não são enviadas.

### Ajustes e recursos do celular

| Função | Para que serve e como usar |
| --- | --- |
| Seu nome | Personaliza a saudação. Nome e orçamento são opcionais na apresentação do primeiro uso. |
| Exportar backup | Prepara um JSON com tarefas, movimentações, cartões, rotinas, metas, saldos iniciais, orçamentos e configurações de lembretes. No celular, escolha onde guardar pelo compartilhamento; no computador, baixe o arquivo. |
| Importar backup | Selecione um JSON do DailyAPP e confirme a restauração. **Substitui os dados atuais**, não mescla. Backups anteriores continuam aceitos; exporte os dados atuais antes se quiser preservá-los. |
| Carregar/Explorar exemplo | Carrega uma rotina fictícia para conhecer as telas. Se já houver dados, solicita confirmação para substituí-los. **Começar com seus dados** remove tarefas, movimentações e orçamento do exemplo, preservando os registros pessoais adicionados. |
| Como usar o DailyAPP | Abre o guia rápido dentro do aplicativo. |
| Lembretes no celular | Mostra quantos avisos estão programados e permite ativar/atualizar notificações. Se a permissão foi negada, permita-a nas configurações do aparelho. |
| Apagar meus dados | Após confirmação, remove todos os registros e configurações financeiras locais. Só um backup exportado permite recuperá-los. |
| Navegação inferior | Abre Hoje, Agenda, Tarefas, Finanças e Ajustes. |
| Botão voltar no Android | Fecha formulários, confirmações e o guia; depois retorna a Hoje e, ao voltar novamente, minimiza o app. |
| Uso sem internet | Tarefas, finanças, metas, previsão e lembretes locais funcionam no aparelho. Cada instalação tem seus próprios dados; use backup para transferir entre aparelhos. |

## Preparar os projetos

Requer Node.js 22.12 ou superior e npm.

```bash
npm ci
npm run mobile:sync
```

Esse comando compila a interface móvel em `dist/mobile/` e copia os arquivos para `android/` e `ios/`. O build móvel abre diretamente o espaço local, sem importar a tela de contas e sem incorporar variáveis Supabase.

Para trabalhar na interface, execute:

```bash
npm run dev -- --mode mobile
```

Esse servidor é uma ferramenta de desenvolvimento; o aplicativo instalado carrega os arquivos que estão dentro do pacote. Não usa um endereço de site remoto.

## Android

Com Android Studio, JDK 21 e Android SDK 36 instalados:

```bash
npm run mobile:android
```

No Android Studio, escolha um celular/emulador e execute o projeto. Para gerar o instalador de uso pessoal pela linha de comando, também com Python 3 instalado:

```bash
npm run mobile:personal
```

O instalador será salvo em `artifacts/DailyAPP-1.1-pessoal.apk`. Usa o build Release, com depuração da aplicação e da WebView desativadas. Mantém o certificado de desenvolvimento do APK anterior para permitir a atualização da instalação pessoal, com `versionCode` 4. Preserve essa chave local ao gerar outras atualizações. A publicação na Play Store requer uma chave de distribuição própria. `npm run mobile:apk` continua disponível para gerar o APK debug.

## iPhone

Em um Mac com Xcode 26 ou superior:

```bash
npm run mobile:ios
```

No Xcode, selecione o projeto **App**, configure sua equipe em **Signing & Capabilities** e execute no simulador ou no iPhone conectado. O projeto usa Swift Package Manager e inclui o manifesto de privacidade exigido pelo plugin de arquivos. O aplicativo requer iOS 15.4 ou superior.

O IPA 1.1 foi compilado e publicado pelo workflow [.github/workflows/personal-release.yml](.github/workflows/personal-release.yml), que usa Xcode 26.3 no runner `macos-15`. Os arquivos da interface incluídos nele foram comparados com o pacote Android e os hashes dos downloads foram conferidos. O resultado é um IPA **sem assinatura pessoal**. As instruções para assinar e instalar estão no [guia de celular](docs/CELULAR.md#iphone-sem-mac-pessoal); a instalação e o funcionamento em um iPhone real ainda precisam ser confirmados. O workflow [ios-personal.yml](.github/workflows/ios-personal.yml) também permite gerar somente um artefato de compilação manual, sem criar uma Release.

## Verificar

```bash
npm run build:mobile
npm test
```

Os 60 testes usam Playwright e Chromium. Verificam previsão de saldo, metas, contas na tela Hoje, tarefas, finanças, dados locais, backups, falhas de armazenamento, datas, navegação, primeiro uso, atualização de dados existentes, acessibilidade e uso da interface móvel sem rede. Os contratos dos plugins nativos são simulados: testes no navegador não substituem a validação no celular, especialmente do teclado, seletor de arquivos e compartilhamento.

Os servidores de teste usam 5174 (base local), 5175 (contas simuladas da base anterior) e 5176 (interface do aplicativo móvel). No ambiente cloud, o navegador disponível é `/usr/bin/chromium`; em outras máquinas, execute `npx playwright install chromium` uma vez.

## Dados e backups

Os registros ficam no armazenamento privado da WebView do aplicativo. Sair e abrir novamente mantém os registros. O formato `dailyapp.v1` foi preservado: usuários com registros existentes entram diretamente no aplicativo. Desinstalar o aplicativo ou limpar seus dados pode removê-los. Em **Ajustes**, exporte um backup para guardar uma cópia ou transferir registros entre aparelhos; a restauração exige confirmação.

O armazenamento local não é um cofre criptografado. A versão móvel atual não conecta bancos, não exige login e não sincroniza aparelhos automaticamente. A base de contas da implementação anterior foi preservada em `src/cloud/` para uma futura etapa, caso seja solicitada; ela não entra no pacote móvel.

## Estrutura

```text
capacitor.config.ts   Nome, identificador e configuração dos aplicativos
android/              Projeto Android e Gradle Wrapper
ios/                  Projeto Xcode e dependências Swift
src/mobile-main.tsx   Entrada do aplicativo instalado
src/mobile/           Compartilhamento, arquivos e botão voltar
src/App.tsx           Tarefas, agenda, finanças e ajustes
src/domain.ts         Tipos, validação e cálculos
resources/            Logo para gerar ícones e abertura
scripts/              Compilação e ferramentas auxiliares
tests/                Verificações da interface e dos contratos
```

No ambiente cloud, use o checkout existente em `/workspace/DailyAPP`. Cada tarefa já é isolada; não crie worktrees sem solicitação. Dependências e ferramentas podem permanecer no snapshot, mas servidores de desenvolvimento precisam ser iniciados novamente. Leia [o guia de celular](docs/CELULAR.md) para os comandos e limites desse ambiente.
