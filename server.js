require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const mysql = require('mysql2/promise');

const app = express();
const rootDir = __dirname;
const uploadDir = path.join(rootDir, 'uploads');
const port = Number(process.env.PORT || 8000);
const databaseName = process.env.DB_NAME || 'BANCO_DE_DADOS_PI';
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: databaseName,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.mimetype)) {
      callback(new Error('Envie uma imagem JPG, PNG ou WebP.'));
      return;
    }

    callback(null, true);
  }
});

app.use(express.json({ limit: '100kb' }));
app.use(session({
  name: 'visionhome.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.use('/IMAGENS2', express.static(path.join(rootDir, 'IMAGENS2')));
app.use('/uploads', express.static(uploadDir));
const publicPages = new Set([
  'index.html',
  'imoveis.html',
  'personalizacao.html',
  'vivi.html',
  'anunciar.html',
  'site.js',
  'style.css'
]);
app.get('/:file', (request, response, next) => {
  if (!publicPages.has(request.params.file)) {
    next();
    return;
  }

  response.sendFile(path.join(rootDir, request.params.file));
});
app.get('/', (request, response) => {
  response.sendFile(path.join(rootDir, 'index.html'));
});

function requireAuthentication(request, response, next) {
  if (!request.session.user) {
    response.status(401).json({ error: 'Entre na sua conta para continuar.' });
    return;
  }

  next();
}

function propertySelect(whereClause = '') {
  return `
    SELECT
      i.ID AS id,
      i.TITULO AS title,
      i.DESCRICAO AS description,
      i.TIPO AS type,
      i.FINALIDADE AS purpose,
      i.PRECO_VENDA AS salePrice,
      i.PRECO_ALUGUEL AS rentPrice,
      i.CIDADE AS city,
      i.UF AS state,
      i.QUARTOS AS bedrooms,
      i.BANHEIROS AS bathrooms,
      i.VAGAS_GARAGEM AS parkingSpaces,
      i.AREA_TOTAL AS totalArea,
      (
        SELECT image.URL_IMAGEM
        FROM IMAGENS_IMOVEIS image
        WHERE image.IMOVEL_ID = i.ID
        ORDER BY image.DESTAQUE DESC, image.ORDEM, image.ID
        LIMIT 1
      ) AS image
    FROM IMOVEIS i
    ${whereClause}
  `;
}

function formatProperty(row) {
  const purpose = String(row.purpose).toLowerCase();
  const amount = purpose === 'aluguel' ? row.rentPrice : row.salePrice;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: String(row.type).toLowerCase(),
    purpose,
    price: Number(amount),
    city: row.city,
    state: row.state,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parkingSpaces: row.parkingSpaces,
    totalArea: Number(row.totalArea),
    image: row.image
  };
}

function parsePropertyForm(body) {
  const text = value => typeof value === 'string' ? value.trim() : '';
  const title = text(body.title);
  const description = text(body.description);
  const type = text(body.type).toUpperCase();
  const purpose = text(body.purpose).toUpperCase();
  const price = Number(body.price);
  const totalArea = Number(body.totalArea);
  const bedrooms = Number(body.bedrooms);
  const bathrooms = Number(body.bathrooms);
  const parkingSpaces = Number(body.parkingSpaces);
  const cep = text(body.cep).replace(/\s/g, '');
  const address = text(body.address);
  const number = text(body.number);
  const neighborhood = text(body.neighborhood);
  const city = text(body.city);
  const state = text(body.state).toUpperCase();

  if (!title || title.length > 150 || !description || !address ||
      !neighborhood || !city || !/^[A-Z]{2}$/.test(state) ||
      !/^[\d-]{8,10}$/.test(cep)) {
    throw new Error('Preencha os dados do imóvel e informe um CEP e uma UF válidos.');
  }

  if (!['CASA', 'APARTAMENTO', 'TERRENO', 'COMERCIAL', 'CHACARA'].includes(type) ||
      !['VENDA', 'ALUGUEL'].includes(purpose)) {
    throw new Error('Selecione um tipo de imóvel e uma finalidade válidos.');
  }

  if (!Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(totalArea) || totalArea <= 0 ||
      ![bedrooms, bathrooms, parkingSpaces].every(value =>
        Number.isInteger(value) && value >= 0)) {
    throw new Error('Preço, área e quantidade de cômodos devem ser válidos.');
  }

  return {
    title,
    description,
    type,
    purpose,
    price,
    totalArea,
    bedrooms,
    bathrooms,
    parkingSpaces,
    cep,
    address,
    number: number || null,
    neighborhood,
    city,
    state
  };
}

app.get('/api/properties', async (request, response, next) => {
  try {
    const [rows] = await pool.query(
      `${propertySelect("WHERE i.STATUS = 'DISPONIVEL'")}
       ORDER BY i.DESTAQUE DESC, i.CRIADO DESC, i.ID DESC`
    );
    response.json(rows.map(formatProperty));
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const { name, username, email, password, cpfCnpj, phone } = request.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedUsername = typeof username === 'string'
      ? username.trim().toLowerCase()
      : '';
    const normalizedCpf = typeof cpfCnpj === 'string' ? cpfCnpj.trim() || null : null;
    const normalizedPhone = typeof phone === 'string' ? phone.trim() || null : null;

    if (!normalizedName || normalizedName.length > 150 ||
        !/^[a-zA-Z0-9._-]{3,50}$/.test(normalizedUsername) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        typeof password !== 'string' || password.length < 8 ||
        password.length > 72 || (normalizedCpf && normalizedCpf.length > 20) ||
        (normalizedPhone && normalizedPhone.length > 20)) {
      response.status(400).json({
        error: 'Informe nome, usuário válido, e-mail válido e senha de 8 a 72 caracteres.'
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO USUARIOS (NOME, USUARIO, EMAIL, SENHA, CPF_CNPJ, TELEFONE)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [normalizedName, normalizedUsername, normalizedEmail, passwordHash, normalizedCpf, normalizedPhone]
    );
    const user = {
      id: result.insertId,
      name: normalizedName,
      username: normalizedUsername,
      email: normalizedEmail
    };
    request.session.user = user;
    response.status(201).json({ user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      response.status(409).json({ error: 'Este usuário, e-mail ou CPF/CNPJ já está cadastrado.' });
      return;
    }

    next(error);
  }
});

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const identifier = typeof request.body.identifier === 'string'
      ? request.body.identifier.trim().toLowerCase()
      : '';
    const password = request.body.password;

    if (!identifier || typeof password !== 'string') {
      response.status(400).json({ error: 'Informe seu usuário/e-mail e sua senha.' });
      return;
    }

    const [rows] = await pool.execute(
      `SELECT ID AS id, NOME AS name, USUARIO AS username, EMAIL AS email, SENHA AS passwordHash
       FROM USUARIOS
       WHERE (USUARIO = ? OR EMAIL = ?) AND ESTADO = 'ATIVO'
       LIMIT 1`,
      [identifier, identifier]
    );
    const account = rows[0];
    const validPassword = account
      ? await bcrypt.compare(password, account.passwordHash)
      : false;

    if (!validPassword) {
      response.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const user = {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email
    };
    request.session.user = user;
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', (request, response) => {
  response.json({ user: request.session.user || null });
});

app.post('/api/auth/logout', (request, response, next) => {
  request.session.destroy(error => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie('visionhome.sid');
    response.status(204).end();
  });
});

app.get('/api/my/properties', requireAuthentication, async (request, response, next) => {
  try {
    const [rows] = await pool.execute(
      `${propertySelect('WHERE i.PROPRIETARIO_ID = ?')}
       ORDER BY i.CRIADO DESC, i.ID DESC`,
      [request.session.user.id]
    );
    response.json(rows.map(formatProperty));
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/properties',
  requireAuthentication,
  uploadPhoto.single('photo'),
  async (request, response, next) => {
    let connection;
    let uploadedFile;

    try {
      const property = parsePropertyForm(request.body);
      uploadedFile = request.file;
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO IMOVEIS (
          PROPRIETARIO_ID, TITULO, DESCRICAO, TIPO, FINALIDADE,
          PRECO_VENDA, PRECO_ALUGUEL, CEP, ENDERECO, NUMERO,
          BAIRRO, CIDADE, UF, QUARTOS, BANHEIROS, VAGAS_GARAGEM,
          AREA_TOTAL, STATUS
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISPONIVEL')`,
        [
          request.session.user.id,
          property.title,
          property.description,
          property.type,
          property.purpose,
          property.purpose === 'VENDA' ? property.price : null,
          property.purpose === 'ALUGUEL' ? property.price : null,
          property.cep,
          property.address,
          property.number,
          property.neighborhood,
          property.city,
          property.state,
          property.bedrooms,
          property.bathrooms,
          property.parkingSpaces,
          property.totalArea
        ]
      );

      if (uploadedFile) {
        await connection.execute(
          `INSERT INTO IMAGENS_IMOVEIS (IMOVEL_ID, URL_IMAGEM, ORDEM, DESTAQUE)
           VALUES (?, ?, 1, TRUE)`,
          [result.insertId, `/uploads/${uploadedFile.filename}`]
        );
      }

      await connection.commit();
      const [rows] = await pool.execute(
        `${propertySelect('WHERE i.ID = ?')}`,
        [result.insertId]
      );
      response.status(201).json(formatProperty(rows[0]));
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      if (uploadedFile) {
        await fs.promises.unlink(uploadedFile.path).catch(cleanupError => {
          console.error('Não foi possível remover a imagem não salva:', cleanupError.message);
        });
      }

      if (error.message.startsWith('Preencha ') ||
          error.message.startsWith('Selecione ') ||
          error.message.startsWith('Preço,')) {
        response.status(400).json({ error: error.message });
        return;
      }

      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(400).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? 'A imagem deve ter no máximo 5 MB.'
        : 'Não foi possível receber a imagem.'
    });
    return;
  }

  if (error.message === 'Envie uma imagem JPG, PNG ou WebP.') {
    response.status(400).json({ error: error.message });
    return;
  }

  console.error('Erro na aplicação VisionHome:', error);
  response.status(500).json({ error: 'Ocorreu um erro interno. Tente novamente.' });
});

async function startServer() {
  await pool.query('SELECT 1');
  app.listen(port, '127.0.0.1', () => {
    console.log(`VisionHome disponível em http://127.0.0.1:${port}`);
    console.log(`Conectado ao banco MySQL ${databaseName}.`);
  });
}

startServer().catch(error => {
  console.error(
    `Não foi possível conectar ao MySQL. Confira DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME: ${error.message}`
  );
  process.exitCode = 1;
});
