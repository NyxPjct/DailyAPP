# Publicar a prévia do DailyAPP

A pasta da prévia contém o aplicativo pronto para hospedagem estática: tarefas, agenda e finanças funcionam sem Supabase. Os registros ficam no navegador de cada pessoa. Contas e sincronização entre dispositivos precisam de um projeto Supabase e de outro build, conforme [o guia de produção](PRODUCAO.md).

## Publicar pelo navegador

1. Crie sua conta no [Netlify](https://app.netlify.com/signup) e escolha o plano gratuito. O cadastro e a entrada são feitos diretamente no serviço.
2. Obtenha o arquivo `artifacts/DailyAPP-previa-netlify.zip` gerado no ambiente e descompacte-o. Ele contém a pasta `DailyAPP-previa/` com `index.html`, `favicon.svg` e `assets/`.
3. Entre na conta e abra o [Netlify Drop](https://app.netlify.com/drop).
4. Arraste a pasta **DailyAPP-previa** para a área de envio. Envie a pasta que contém `index.html` diretamente; preserve a subpasta `assets/`.
5. Abra o endereço HTTPS fornecido pelo Netlify. Clique em **Explorar exemplo** para conhecer as telas com dados fictícios ou cadastre suas próprias tarefas e movimentações.

O link público só passa a existir depois desse envio. Não é necessário comprar um domínio para acessar o endereço fornecido pelo serviço. Não envie `.env`, código-fonte ou `node_modules`: o pacote já contém apenas os arquivos do site.

## Gerar novamente a pasta

No diretório do repositório, com Node.js 22.12 ou superior:

```bash
npm ci
npm run preview:deploy
```

Envie a pasta `dist/netlify-previa/` diretamente ao Netlify Drop. Para transferir a pasta em um único arquivo, compacte seu conteúdo pelo gerenciador de arquivos. Ela contém `index.html` na raiz e a subpasta `assets/`.

O build usa `.env.standalone` e desativa a conexão Supabase. As fontes e os ícones são incluídos no pacote. Esse comando grava somente em `dist/netlify-previa/`; não substitui a pasta de produção inteira nem a prévia HTML independente.

Para atualizar o mesmo site, envie a nova pasta na área de deploy manual desse site no painel do Netlify. Mantenha o mesmo endereço para preservar o acesso aos dados locais: outro endereço tem seu próprio armazenamento. Use **Configurações → Exportar backup** para transferir registros entre endereços.
