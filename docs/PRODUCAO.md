# Ativar contas e sincronização

Esta entrega implementa a primeira etapa da versão 1.0: conta pessoal, autenticação por e-mail e senha, recuperação de senha, importação dos dados locais e sincronização entre dispositivos.

Sem configuração Supabase, o DailyAPP mantém o modo local existente. A integração ainda precisa ser ativada em um projeto real e validada antes de receber usuários.

## 1. Criar o projeto Supabase

Crie um projeto no painel do Supabase. Na configuração de API, obtenha a URL do projeto e a chave pública **publishable**. A chave legada **anon** também é aceita. A chave pública é destinada ao frontend; a segurança dos registros depende das regras do banco descritas abaixo.

Nunca use `service_role` ou uma chave `sb_secret_` em variáveis `VITE_`. O projeto recusa iniciar ou compilar com esses valores na configuração pública.

## 2. Preparar o banco

No SQL Editor do projeto, execute o conteúdo completo de:

```text
supabase/migrations/202610130001_workspaces.sql
```

A migração cria `dailyapp_workspaces`, as regras de leitura por usuário e a função `save_dailyapp_workspace` para escritas atômicas. O proprietário vem da sessão autenticada. O identificador enviado pelo frontend apenas confirma essa identidade e impede que uma requisição antiga grave dados depois de uma troca de conta. Usuários anônimos não acessam os registros, e usuários autenticados não fazem alterações diretamente na tabela.

Os arquivos de `supabase/tests/` criam identidades artificiais apenas para testes locais. **Não execute `bootstrap.sql` no projeto Supabase**: o serviço já fornece o esquema `auth` e suas funções.

## 3. Configurar o frontend

Crie `.env.local` a partir de `.env.example` e preencha os dois campos com os valores públicos do seu projeto:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Em um serviço de hospedagem, configure os mesmos nomes nas variáveis usadas no build. No ambiente cloud do Codex, os nomes também foram registrados nas configurações do ambiente para você preencher. Não envie credenciais privadas pelo chat e não versione `.env.local`.

As variáveis `VITE_` são incorporadas ao frontend durante o build. Depois de configurá-las, reinicie o servidor de desenvolvimento ou gere um novo build.

A rede deste ambiente cloud usa uma lista de destinos permitidos. Adicione o **hostname exato** da URL do seu projeto nas configurações de rede para validar chamadas ao Supabase a partir da máquina cloud. Preserve os destinos que já estiverem configurados. Não é necessário um token administrativo para o aplicativo.

## 4. Configurar os e-mails de acesso

Em Authentication / URL Configuration, ajuste o Site URL e os Redirect URLs para o endereço em que o frontend será usado. Os links de confirmação e recuperação retornam ao endereço atual da aplicação.

Mantenha a confirmação de e-mail habilitada. Configure o envio de e-mails/SMTP para seus usuários e teste a entrega de confirmação e recuperação no projeto real. Os testes automatizados deste repositório verificam esses fluxos com respostas de API simuladas; não verificam a entrega de mensagens reais.

## 5. Gerar e hospedar

```bash
npm ci
npm run build
```

Publique o conteúdo de `dist/` em uma hospedagem estática com HTTPS. O frontend usa a API do Supabase; não precisa de um servidor Node em produção.

`npm run preview:file` gera uma demonstração HTML independente em **modo local**, ignorando a conexão com contas. Esse comando substitui o conteúdo de `dist/`. Para hospedar a versão com Supabase, gere novamente `npm run build` com as variáveis públicas configuradas.

Publicar o ambiente cloud do Codex salva a configuração e seus arquivos. Isso é separado da hospedagem do site.

## Como os dados são protegidos e sincronizados

- Cada conta tem um documento JSONB com uma revisão no banco. Tarefas, finanças e orçamento são gravados juntos, evitando atualizações parciais.
- A leitura usa Row Level Security e a identidade autenticada do Supabase.
- A escrita só ocorre pela função que valida o documento e compara a revisão. Se outro dispositivo atualizou o registro, a escrita antiga é recusada.
- O dispositivo preserva uma fila local de alterações até a confirmação do servidor. A conexão é verificada novamente ao voltar à janela, recuperar a rede ou após 30 segundos.
- Um conflito bloqueia novas edições até sua resolução. Nas configurações, exporte a cópia local e confirme o carregamento da versão da nuvem. Essa cópia pode ser importada depois como backup.
- O cache de cada conta usa uma chave separada `dailyapp.cloud.v1:<user-id>`. Ao sair, a interface volta à tela de acesso e não mostra a conta anterior. Alterações pendentes precisam ser sincronizadas ou resolvidas antes da saída pelo aplicativo.
- O cache no dispositivo permite retomar alterações pendentes. Ele permanece no navegador; não é um cofre criptografado. Para remover dados de um dispositivo, guarde os backups desejados e limpe os dados do site no navegador.

O limite por documento é de 5 MB, com até 5.000 tarefas e 10.000 movimentações. Valores monetários continuam sendo centavos inteiros.

## Migrar a versão atual

Depois de entrar, abra **Configurações → Importar meus dados locais**. A importação é explícita, preserva os registros que já existem na conta e não duplica identificadores. Dados de exemplo são ignorados. A cópia original `dailyapp.v1` é mantida.

Essa opção encontra os dados do mesmo navegador e endereço. Para transferir dados da prévia HTML ou de outro endereço, exporte um backup naquela versão e importe-o na conta.

## Verificação

```bash
npm run build
npm test
npm run test:db
```

`npm test` verifica a aplicação local, contratos de autenticação e API simulados, migração, recuperação de senha, fila offline, conflitos, persistência, acessibilidade e isolamento do estado entre contas. As portas 5174 e 5175 são reservadas para servidores de teste independentes. Não são usados dados de usuários reais.

`npm run test:db` usa Docker e Python 3 para iniciar um PostgreSQL 17 descartável, sem expor portas. Testa a migração duas vezes e verifica RLS, revisão, validação de dados e negação de acesso anônimo. O container e sua senha efêmera são removidos ao terminar.

Antes de abrir o site a outras pessoas, confirme no seu projeto real: cadastro e confirmação por e-mail, recuperação de senha, acesso em dois dispositivos, importação de um backup e isolamento entre duas contas distintas.

## Próximas etapas

A próxima etapa do produto pode acrescentar tarefas recorrentes, lembretes, parcelas, metas de economia e instalação como aplicativo. A base de contas e sincronização desta entrega permite desenvolver esses fluxos sem substituir os registros existentes.
