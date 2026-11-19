# VisionHome

## Executar localmente

1. Instale o Node.js e inicie o serviço MySQL 5.7.
2. Copie `.env.example` para `.env` e preencha as credenciais do seu MySQL. O arquivo `.env` fica apenas no seu computador.
3. Na primeira execução, crie e preencha as tabelas:

   ```powershell
   npm run db:setup
   ```

   O script importa `database/BANCODEDADOSPI.sql`. Execute-o uma única vez em um banco ainda não inicializado.
   Para criar a primeira conta administrativa, preencha `VISIONHOME_FIRST_USERNAME` e `VISIONHOME_FIRST_PASSWORD` no `.env` antes da importação. Essa conta usa usuário e senha; os dados de contato são opcionais para ela.
4. Inicie o site e a API:

   ```powershell
   npm start
   ```

5. Acesse <http://127.0.0.1:8000>.

Depois da primeira conta, novos usuários podem se cadastrar pela página. As senhas são armazenadas com hash; as senhas de exemplo do SQL fornecido não são credenciais válidas.
