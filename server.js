const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 8,
  message: { error: 'Trop de requêtes, rechargez dans une minute.' }
});

app.use('/api/', limiter);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER || 'contact@codialis.com',
    pass: process.env.SMTP_PASS || ''
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, company, email, phone, service, budget, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Nom, email et message sont obligatoires.' });
    }

    const htmlBody = `
      <h2>Nouveau message depuis le formulaire Codialis</h2>
      <p><strong>Nom :</strong> ${name}</p>
      <p><strong>Entreprise :</strong> ${company || '—'}</p>
      <p><strong>Email :</strong> ${email}</p>
      <p><strong>Téléphone :</strong> ${phone || '—'}</p>
      <p><strong>Service demandé :</strong> ${service || '—'}</p>
      <p><strong>Budget estimatif :</strong> ${budget || '—'}</p>
      <p><strong>Message :</strong><br>${message.replace(/\n/g, '<br>')}</p>
      <hr />
      <p>Envoyé depuis : <strong>https://www.codialis.com</strong></p>
    `;

    const info = await transporter.sendMail({
      from: `Codialis Site <${process.env.SMTP_USER || 'contact@codialis.com'}>`,
      to: process.env.TO_EMAIL || 'contact@codialis.com',
      subject: `Nouveau contact: ${name} (${service || 'sans service'})`,
      replyTo: email,
      text: `Nom: ${name}\nEntreprise: ${company || '-'}\nEmail: ${email}\nTéléphone: ${phone || '-'}\nService: ${service || '-'}\nBudget: ${budget || '-'}\nMessage:\n${message}`,
      html: htmlBody
    });

    console.log('Email envoyé :', info.messageId);
    return res.status(200).json({ message: 'Message envoyé.' });
  } catch (error) {
    console.error('Erreur API contact:', error);
    return res.status(500).json({ error: 'Impossible d\'envoyer le message pour le moment.' });
  }
});

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
