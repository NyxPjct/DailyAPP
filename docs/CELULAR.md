# DailyAPP 1.1 para uso pessoal

## O que esta versão entrega

O aplicativo abre em inglês por padrão. Para trocar, abra **Settings → App language** e selecione **Português**, **Español**, **Français** ou **Deutsch**. Telas, categorias, formulários, ajuda, datas, números e lembretes acompanham a escolha. Os dados digitados são preservados no idioma original, e os valores continuam em reais (BRL). O idioma fica salvo e entra no backup; arquivos antigos mantêm a preferência atual. As capturas do README mostram inglês e os outros quatro idiomas.

O DailyAPP usa os arquivos da aplicação dentro do instalador, com navegação inferior, ícones próprios, botão voltar no Android e compartilhamento de backups. Tarefas, agenda e finanças funcionam localmente. No primeiro uso, escolha seu nome e limite de gastos ou pule essa configuração. Em Ajustes, **Como usar o DailyAPP** abre o guia rápido. Não é necessário criar conta no Netlify ou Supabase.

As pastas `android/` e `ios/` são projetos nativos completos do Capacitor. A interface móvel fica em `src/mobile-main.tsx`. `npm run build:mobile` usa a entrada móvel, desativa variáveis Supabase e gera `dist/mobile/`; `npm run mobile:sync` também copia o build e registra os plugins nos dois projetos.

## Instalar no Android

O APK pessoal está disponível para [download direto no GitHub](https://github.com/NyxPjct/DailyAPP/raw/refs/heads/main/downloads/DailyAPP-1.1-pessoal.apk). As [Releases](https://github.com/NyxPjct/DailyAPP/releases) reúnem os instaladores publicados.

Obtenha `artifacts/DailyAPP-1.1-pessoal.apk`, transfira-o para o celular Android e abra o arquivo. O sistema pode pedir autorização para instalar arquivos recebidos pelo aplicativo que está abrindo o APK. Depois da instalação, abra **DailyAPP** pela lista de aplicativos.

Requer Android 7 ou superior e uma WebView atualizada. O pacote pessoal usa o build **Release**, com depuração da aplicação e da WebView desativadas, mas conserva o certificado de desenvolvimento da instalação anterior. É uma distribuição pessoal; a publicação na Play Store terá uma configuração própria de assinatura.

Se instalou o APK de teste anterior desta sessão, exporte um backup em Ajustes e abra o novo APK **sem desinstalar o DailyAPP**. O identificador `com.nyxpjct.dailyapp` e o certificado foram mantidos; o código da versão passa para 5, com nome 1.1.0. Isso permite atualizar preservando os dados. O formato local também foi mantido. A instalação sobre a versão anterior ainda deve ser confirmada em um aparelho real.

Para gerar futuras atualizações compatíveis, preserve a chave local de desenvolvimento em `.cache/android-user/debug.keystore`. Ela fica fora do Git e do ZIP de código. Compilar em uma máquina com uma chave diferente cria uma assinatura diferente; nesse caso, a atualização pode ser recusada pelo Android. Desinstalar ou limpar os dados pode apagar os registros; restaure um backup se precisar fazer isso.

## Compilar o Android novamente

Instale Android Studio e, pelo SDK Manager, Android SDK Platform 36, Platform-Tools e Build-Tools 36.0.0. O projeto usa JDK 21 e Gradle 8.14.3 com checksum oficial fixado no wrapper.

```bash
npm ci
npm run mobile:android
```

Esse comando abre o Android Studio. Use **Run** para executar em um aparelho conectado ou em um emulador. Também é possível gerar o APK com:

```bash
npm run mobile:personal
```

Esse comando requer Python 3 para o helper de compilação. Ele usa `JAVA_HOME`, `ANDROID_HOME`/`ANDROID_SDK_ROOT` e a configuração local do Android Studio. Quando necessário, defina `JAVA_HOME` para o JDK 21 e `ANDROID_HOME` para a pasta do SDK. `android/local.properties` é uma configuração local, ignorada pelo Git.

No Windows, você pode compilar no Android Studio ou, depois de `npm run mobile:sync`, executar `gradlew.bat assembleRelease` dentro de `android/`. O APK fica em `android/app/build/outputs/apk/release/app-release.apk`. O helper `mobile:personal` usa a chave do cache local; uma compilação direta pelo Android Studio pode usar outra chave de desenvolvimento. Para depurar, use `npm run mobile:apk` ou `assembleDebug`.

## Experimentar no computador

Baixe a [prévia para computador](https://github.com/NyxPjct/DailyAPP/releases/download/personal-v1.1.0-r1/DailyAPP-index.zip) ou use `artifacts/index.html` / `artifacts/DailyAPP-index.zip` e abra `index.html` no Chrome ou Edge. O arquivo já contém a interface e seus recursos. Para atualizá-lo no projeto:

```bash
npm run preview:computer
```

Esse comando preserva o build nativo em `dist/mobile`. Os dados ficam no navegador do computador. Para transferi-los, exporte um backup e importe-o no aplicativo. O navegador administrado deste ambiente bloqueia navegação `file://`; a validação aqui usa HTTP interno, sem alterar essa política. A abertura direta deve ser confirmada no seu computador.

## iPhone sem Mac pessoal

Baixe [DailyAPP-1.1-sem-assinatura.ipa](https://github.com/NyxPjct/DailyAPP/releases/download/personal-v1.1.0-r1/DailyAPP-1.1-sem-assinatura.ipa) da [release pessoal](https://github.com/NyxPjct/DailyAPP/releases/tag/personal-v1.1.0-r1). O pacote foi compilado com Xcode 26.3 no GitHub Actions para arm64, iOS 15.4 ou superior, versão 1.1.0 (código 5). Seu SHA-256, integridade do ZIP, manifesto de privacidade, plugin de notificações e os 22 arquivos da interface foram conferidos após o download. Ele ainda precisa de assinatura pessoal; não instala sozinho.

No Windows, instale o **AltServer** pelo site oficial [altstore.io](https://altstore.io), siga as instruções oficiais para instalar o AltStore no seu próprio iPhone e importe o IPA nele. Forneça sua conta Apple apenas nas ferramentas oficiais do seu computador/aparelho.

Assinaturas com conta Apple gratuita normalmente expiram após sete dias e precisam ser renovadas, conforme as regras atuais da Apple e da ferramenta utilizada. No Linux, essa opção de assinatura exige acesso a um Windows ou Mac compatível com o AltServer; este projeto não inclui um instalador de assinatura para Linux.

Para compilar novamente usando o Mac do GitHub Actions:

1. Salve suas alterações no repositório do GitHub. O código desta versão já está enviado.
2. No GitHub, abra **Actions → iPhone - pacote pessoal sem assinatura → Run workflow**. Escolha a branch com o código atualizado.
3. Aguarde a compilação e baixe o artefato **DailyAPP-iPhone-sem-assinatura** no final da execução. Extraia `DailyAPP-1.1-sem-assinatura.ipa` do ZIP.
4. Assine o novo IPA para seu iPhone usando as instruções acima.

O workflow `ios-personal.yml` é manual e usa permissões de leitura do repositório. O workflow `personal-release.yml` também é disparado por tags `personal-v*` e usa permissão de escrita para publicar os arquivos em uma Release. Ambos usam Xcode 26.3 no runner `macos-15`, dispensam certificados Apple no GitHub e não enviam o aplicativo às lojas. A disponibilidade de minutos macOS depende da sua conta GitHub. A compilação de lançamento iOS foi concluída no workflow de publicação; a assinatura e a instalação pessoal ainda precisam ser confirmadas no aparelho.

## iPhone com acesso a um Mac

Use um **Mac com Xcode 26 ou superior**, Node.js e npm. O aplicativo requer iOS 15.4 ou superior. No diretório do projeto:

```bash
npm ci
npm run mobile:ios
```

No Xcode:

1. Aguarde a resolução das dependências Swift Package Manager.
2. Selecione o target **App**, abra **Signing & Capabilities** e escolha sua equipe Apple.
3. Escolha um simulador de iPhone ou o iPhone conectado e execute **Run**.

Não é preciso uma conta Apple Developer paga para usar o simulador. Uma equipe pessoal pode servir para testes no próprio iPhone, sujeita aos limites de assinatura da Apple. TestFlight e App Store exigem Apple Developer e configuração de distribuição.

Esta máquina cloud é Linux: não possui Xcode e não gera um IPA assinado. O IPA desta versão foi compilado no runner macOS do GitHub. Para assinar e executar diretamente pelo Xcode, use o Mac e sua equipe pessoal. Confira teclado, importação e compartilhamento no aparelho.

O manifesto `ios/App/App/PrivacyInfo.xcprivacy` está registrado no target e declara o acesso a timestamps de arquivos exigido pelo plugin Filesystem. O backup usa o cache privado e o seletor de compartilhamento do sistema. O app não solicita acesso amplo à pasta de documentos, câmera ou localização.

## Usar os novos recursos da versão 1.1

Em **Hoje → Contas e recebimentos**, acompanhe pendências anteriores, de hoje e dos próximos sete dias, incluindo parcelas. Toque na descrição para editar e em **Pagar** ou **Receber** para confirmar o mesmo registro. Para desfazer, mude o status da movimentação em Finanças.

Em **Finanças → Planejamento**, defina o saldo disponível no início do mês, antes da primeira movimentação desse mês. Zero e valores negativos são aceitos. A previsão soma receitas e desconta despesas, confirmadas e previstas, incluindo cada parcela no seu vencimento. **Ver evolução por dia** mostra os saldos ao fim de cada data e o aviso destaca estimativas negativas. Saldos iniciais são independentes entre meses. Contas antigas aparecem como aviso e em Hoje; ajuste a data caso o pagamento passe a ocorrer no mês atual. Não há consulta a bancos.

Em **Planejamento → Nova meta**, cadastre o valor desejado, prazo e total guardado. **Atualizar meta** modifica o total guardado, em vez de somar um depósito; o progresso e a sugestão mensal acompanham a mudança. Você pode arquivar/reativar ou excluir com confirmação. Metas não movimentam dinheiro nem alteram o saldo da previsão automaticamente. O [guia completo das funções no README](../README.md#what-each-feature-does) explica cada tela e botão.

Em **Nova tarefa**, escolha uma frequência em **Repetir tarefa**. Em **Nova movimentação**, use **Repetir movimentação** para receitas ou contas fixas. As novas ocorrências começam pendentes, e uma edição muda apenas o registro escolhido. Abra **Rotinas recorrentes** em Tarefas ou Finanças para encerrar uma rotina: registros anteriores, os de hoje e ocorrências já concluídas/pagas são mantidos. Excluir só uma ocorrência não a recria ao abrir novamente.

O app prepara até 90 dias de tarefas e 12 meses de movimentações e amplia esse período ao abrir ou retomar o aplicativo. Não marca pagamentos ou conclusões automaticamente. O formato de backup `dailyapp.v1` continua aceitando os arquivos da versão anterior e acrescenta os novos campos opcionais.

Em **Finanças → Cartões e parcelas**, cadastre nome, limite e dias de fechamento/vencimento. Registre o valor total da compra e de 1 a 48 parcelas. Compras no dia de fechamento ou depois entram no próximo ciclo. Dias 29, 30 ou 31 são ajustados em meses menores; valores são divididos em centavos sem perder o total. Mudanças nos dias do cartão valem para compras novas, preservando registros existentes. Marcar uma fatura como paga atualiza suas parcelas; não cria outra despesa. Arquivar um cartão impede novas compras e preserva o histórico, e é possível reativá-lo.

Para **lembretes**, escolha uma antecedência na tarefa, movimentação ou cartão e permita notificações no celular. Tarefas precisam de horário; contas e faturas avisam às 9h locais. Confira o status em **Ajustes → Lembretes no celular**. Os próximos avisos são programados pelo sistema, sem servidor, e renovados ao abrir o app. Até 60 avisos são mantidos, incluindo eventuais avisos que o sistema ainda não entregou. No Android, o horário pode ser ajustado para economizar bateria. A prévia no computador salva a preferência e não envia notificações.

## Dados entre aparelhos

Cada instalação mantém seus próprios registros. Em **Ajustes → Exportar backup**, escolha onde guardar ou enviar o JSON pelo compartilhamento do celular. No outro aparelho, abra **Ajustes → Importar backup**, escolha o arquivo e confirme a restauração. Isso substitui os registros atuais; exporte-os antes caso queira preservá-los.

Os dados locais usam `dailyapp.v1` dentro da WebView. Não são um armazenamento criptografado. A sincronização automática por conta é uma etapa futura separada. Dados da antiga demonstração web não são transferidos automaticamente: use exportação e importação de backup.

## Conferir no seu aparelho

Antes de depender do aplicativo no dia a dia, faça uma experiência com poucos registros: crie uma tarefa, registre uma receita e uma despesa, defina o orçamento e confira os totais. Feche e reabra o aplicativo sem internet. Exporte um backup, confira que o arquivo foi salvo no destino escolhido e importe-o novamente. No Android, atualize sobre a instalação anterior e confira os registros. No iPhone, confira também o prazo e o processo de renovação da assinatura pessoal.

## Desenvolvimento no ambiente cloud

O checkout fica em `/workspace/DailyAPP`; use-o diretamente. As ferramentas instaladas e verificadas nesta sessão ficam em `/workspace/.toolchains/`: JDK 21, Android SDK 36, Build-Tools e Platform-Tools. Foram obtidas dos distribuidores oficiais com verificação dos hashes. As ferramentas de linha de comando Android 19.0 são usadas porque a ferramenta mais recente tenta criar arquivos fora das áreas graváveis do ambiente.

O SDK Manager requer um diretório gravável em `ANDROID_USER_HOME`. O helper `scripts/build-android.py` configura o cache do Android e do Gradle em `.cache/`, reutiliza os toolchains deste ambiente e aplica os proxies HTTP/HTTPS herdados ao Java sem exibir valores de credenciais. Preserve a confiança TLS: o JDK precisa confiar no certificado de proxy configurado pelo ambiente. Não desative validação de certificados.

Para reinstalar dependências e preparar os arquivos móveis:

```bash
npm ci
npm run mobile:sync
npm test
```

Para trabalhar na interface, execute `npm run dev -- --mode mobile --port 5173 --strictPort` e valide requisições apenas internamente. A interface de configuração cloud não disponibiliza uma prévia interativa por localhost. A prévia de uso real é a instalação do APK ou a execução pelo Xcode.

Para atualizar a identidade visual, altere `resources/logo.svg` e execute `npm run mobile:icons`. Os recursos gerados ficam nos projetos nativos.

Os testes de plugins no Playwright usam uma ponte nativa simulada. O build Android e o archive iOS no GitHub Actions verificam a compilação real dos projetos. Eles não comprovam funcionamento físico no Android ou no iPhone. A publicação dos arquivos no GitHub também não publica o aplicativo nas lojas.

O identificador atual é `com.nyxpjct.dailyapp`. Antes da primeira publicação nas lojas, confirme o identificador, a conta do responsável, a política de privacidade e a assinatura da versão de lançamento. Não versione chaves de assinatura ou certificados pessoais.
