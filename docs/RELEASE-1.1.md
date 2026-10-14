# DailyAPP 1.1 — currency conversion, five languages, and planning

Atualização da versão 1.1.0, build 7. Mantém a versão 1.1 e acrescenta:

- Moeda automática ao trocar idioma: inglês → USD, português → BRL, espanhol/francês/alemão → EUR. Usa a cotação salva sem internet ou busca uma taxa; sem taxa válida, mantém a moeda anterior com aviso.
- A cotação recebida só altera a moeda depois de fechar formulários abertos. Mudanças de idioma, escolha manual e restauração cancelam conversões pendentes.
- Escolha manual disponível até a próxima troca de idioma, com screenshots atualizados nos cinco idiomas.

- Conversão real entre BRL, USD, EUR, GBP, CAD e AUD, com escolha manual e troca automática junto ao idioma, em valores, gráficos, cartões, orçamentos, metas e previsão.
- Cotação diária da Currency API via jsDelivr, com data e origem; taxa manual e última cotação salva sem internet. Novas taxas são aplicadas ao salvar a moeda.
- Novos campos aceitam a moeda selecionada e convertem para BRL ao salvar. Histórico preservado em centavos, inclusive ao salvar um campo convertido sem alteração.
- Moeda e cotações incluídas no backup, com compatibilidade para arquivos antigos. Valores são estimativas pela cotação atual, sem tarifa bancária ou taxa histórica.

- Inglês por padrão com troca completa para português, espanhol, francês e alemão em Settings → App language. O idioma fica salvo e entra no backup.
- Telas, categorias, filtros, formulários, ajuda, avisos, datas e números nos cinco idiomas. Valores continuam em reais; conteúdo digitado é preservado.
- Lembretes nativos atualizados no idioma escolhido, incluindo avisos ainda não entregues pelo sistema.
- README atualizado e 15 capturas reais da interface, três para cada idioma.

- Hoje com contas e recebimentos pendentes, incluindo atrasos e parcelas dos próximos sete dias. Confirme pagamentos e recebimentos sem criar outro registro.
- Metas financeiras com valor desejado, prazo, total guardado, progresso, sugestão mensal, arquivamento e reativação. Metas são acompanhamento manual e não alteram o saldo automaticamente.
- Previsão de saldo com valor inicial de cada mês, receitas/despesas confirmadas e previstas, evolução diária e aviso de saldo negativo. Não consulta bancos; cada parcela entra no mês correspondente uma vez.
- README com guia das funções de Hoje, Agenda, Tarefas, Finanças, Cartões, Planejamento, Lembretes e Ajustes.
- ZIP com `index.html` para abrir a interface no computador.

- Lembretes locais de tarefas, contas e faturas, com permissão do celular. Funcionam sem servidor ou conta. Avisos são retirados ao concluir, pagar ou excluir registros; avisos atrasados pelo sistema são preservados enquanto ainda forem válidos.
- Tarefas e receitas/despesas com repetição diária, semanal, mensal ou anual. Próximas ocorrências começam pendentes. É possível editar uma ocorrência ou encerrar a rotina preservando o histórico.
- Cartões com limite, fechamento e vencimento; compras em até 48 parcelas, divisão exata dos centavos e pagamento da fatura sem duplicar despesas. Arquivar um cartão preserva as parcelas.
- Backups anteriores continuam aceitos. Novos backups preservam cartões, parcelas, rotinas, metas, saldos iniciais e configurações de lembretes.

## Downloads e instalação

- `DailyAPP-1.1-pessoal.apk`: Android 7 ou superior. Mantém o identificador e certificado da versão pessoal anterior, com versão 1.1.0 (build 7). Exporte um backup e instale sobre a versão anterior, sem desinstalar.
- `DailyAPP-1.1-sem-assinatura.ipa`: iOS 15.4 ou superior. Precisa de assinatura pessoal para instalar. No Windows, siga o guia oficial do AltServer/AltStore em [altstore.io](https://altstore.io). Contas gratuitas normalmente exigem renovação após sete dias.
- Arquivos `.sha256`: hashes para verificar os downloads.
- `DailyAPP-index.zip`: extraia e abra `index.html` no Chrome ou Edge. Dados ficam no navegador; transfira por backup. A prévia salva preferências, mas não envia notificações nativas.

Escolha o lembrete ao editar a tarefa, conta ou cartão e permita notificações. Contas e faturas avisam às 9h locais. Até 60 avisos próximos são atualizados ao abrir o app; o sistema pode ajustar o horário para economizar bateria. A prévia no computador salva as preferências e não envia notificações.

Verificação: 87 testes da aplicação foram validados, com cenários dos cinco idiomas, de cálculos, backups, dados anteriores, acessibilidade e ponte nativa simulada. Testes em aparelhos reais continuam necessários para confirmar teclado, notificações, compartilhamento e instalação da atualização. Estes downloads são para uso pessoal e não publicam o aplicativo nas lojas.
