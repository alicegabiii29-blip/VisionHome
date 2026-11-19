require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function setupDatabase() {
  const sqlPath = path.join(__dirname, '..', 'database', 'BANCODEDADOSPI.sql');
  const databaseName = process.env.DB_NAME || 'BANCO_DE_DADOS_PI';
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error('DB_NAME pode conter apenas letras, números e sublinhados.');
  }
  const username = process.env.VISIONHOME_FIRST_USERNAME?.trim().toLowerCase();
  const password = process.env.VISIONHOME_FIRST_PASSWORD;

  if ((username || password) &&
      (!username || !/^[a-z0-9._-]{3,50}$/.test(username) ||
       typeof password !== 'string' || password.length < 8 || password.length > 72)) {
    throw new Error('Configure um usuário válido e uma senha de 8 a 72 caracteres para a primeira conta.');
  }

  const sql = (await fs.readFile(sqlPath, 'utf8'))
    .replace(
      'CREATE DATABASE BANCO_DE_DADOS_PI CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    )
    .replace('USE BANCO_DE_DADOS_PI;', `USE \`${databaseName}\`;`);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    multipleStatements: true
  });

  try {
    await connection.query(sql);

    if (username || password) {
      const passwordHash = await bcrypt.hash(password, 12);
      await connection.execute(
        `INSERT INTO USUARIOS (NOME, USUARIO, SENHA, TIPO, ESTADO)
         VALUES (?, ?, ?, 'ADMIN', 'ATIVO')`,
        [username, username, passwordHash]
      );
    }

    console.log(`Banco ${databaseName} criado e populado.`);
  } finally {
    await connection.end();
  }
}

setupDatabase().catch(error => {
  console.error('Não foi possível preparar o banco de dados:', error.message);
  process.exitCode = 1;
});
