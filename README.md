# DailyAPP 1.0 — uso pessoal

Aplicativo de tarefas, agenda e finanças pessoais em português. A interface React é empacotada com Capacitor em aplicativos instalados no celular. As telas, fontes e ícones fazem parte da instalação; o funcionamento local dispensa hospedagem, Netlify e Supabase.

O Android gera `artifacts/DailyAPP-1.0-pessoal.apk`, pronto para instalação manual. O projeto iOS inclui uma compilação manual pelo GitHub Actions em um Mac na nuvem, para quem usa Windows ou Linux; o IPA resultante ainda precisa de assinatura pessoal. Consulte [Instalar e compilar no celular](docs/CELULAR.md).

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
- Receitas, despesas, valores pagos ou previstos, histórico, categorias e orçamento mensal.
- Dados salvos no próprio dispositivo, sem exigir conta ou conexão com a internet.
- Exportação de backup JSON pelo compartilhamento do Android/iPhone e importação pelo seletor de arquivos.
- Botão voltar do Android fecha formulários e retorna ao início antes de minimizar o aplicativo.
- Layout adaptado às áreas seguras da tela e ícones próprios para as duas plataformas.

O saldo considera receitas recebidas e despesas pagas no mês. O orçamento inclui despesas pagas e previstas. Os cálculos usam centavos inteiros. Há dados fictícios opcionais em **Explorar exemplo**.

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

O instalador será salvo em `artifacts/DailyAPP-1.0-pessoal.apk`. Usa o build Release, com depuração da aplicação e da WebView desativadas. Mantém o certificado de desenvolvimento do APK anterior para permitir a atualização da instalação pessoal, com `versionCode` 2. Preserve essa chave local ao gerar outras atualizações. A publicação na Play Store requer uma chave de distribuição própria. `npm run mobile:apk` continua disponível para gerar o APK debug.

## iPhone

Em um Mac com Xcode 26 ou superior:

```bash
npm run mobile:ios
```

No Xcode, selecione o projeto **App**, configure sua equipe em **Signing & Capabilities** e execute no simulador ou no iPhone conectado. O projeto usa Swift Package Manager e inclui o manifesto de privacidade exigido pelo plugin de arquivos. O aplicativo requer iOS 15.4 ou superior.

A compilação iOS precisa do Xcode. Quem usa Windows ou Linux pode usar o workflow manual [.github/workflows/ios-personal.yml](.github/workflows/ios-personal.yml), que compila no runner macOS do GitHub com Xcode 26.3. Ele gera um IPA **sem assinatura**, sem publicar nas lojas. As instruções de assinatura pessoal e instalação estão no [guia de celular](docs/CELULAR.md#iphone-sem-mac-pessoal). Esse workflow está preparado, mas sua execução e a instalação em iPhone ainda precisam ser verificadas no macOS e no aparelho.

## Verificar

```bash
npm run build:mobile
npm test
```

Os 38 testes usam Playwright e Chromium. Verificam tarefas, finanças, dados locais, backups, falhas de armazenamento, datas, navegação, primeiro uso, atualização de dados existentes, acessibilidade e uso da interface móvel sem rede. Os contratos dos plugins nativos são simulados: testes no navegador não substituem a validação no celular, especialmente do teclado, seletor de arquivos e compartilhamento.

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
