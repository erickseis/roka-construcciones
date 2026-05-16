/**
 * Script para obtener el refresh_token de Gmail OAuth2.
 * Ejecutar UNA SOLA VEZ para configurar el envío de emails.
 *
 * Uso:
 *   npx tsx scripts/gmail-oauth-setup.ts
 *
 * Copia el refresh_token resultante y pégalo en
 * Configuración → Notificaciones Email → Refresh Token.
 */

import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const CLIENT_SECRET_PATH = path.join(
  __dirname,
  '../../client_secret_485821130387-sla3bleu8ditt3p9608s5358sdqb5v3o.apps.googleusercontent.com.json'
);

interface ClientSecret {
  web: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

function readClientSecret(): ClientSecret {
  if (!fs.existsSync(CLIENT_SECRET_PATH)) {
    throw new Error(`No se encontró el archivo client_secret en:\n  ${CLIENT_SECRET_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
}

function buildAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://mail.google.com/',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ refresh_token: string; access_token: string }> {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(`${parsed.error}: ${parsed.error_description}`));
          else resolve(parsed);
        } catch {
          reject(new Error('Respuesta inválida de Google'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function waitForCode(redirectUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(redirectUri);
    const port = Number(url.port) || 3000;

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url!, `http://localhost:${port}`);
      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (code) {
        res.end('<h2 style="font-family:sans-serif;color:green">✓ Autorización exitosa. Puedes cerrar esta ventana.</h2>');
        server.close();
        resolve(code);
      } else {
        res.end(`<h2 style="font-family:sans-serif;color:red">✗ Error: ${error}. Cierra esta ventana e intenta de nuevo.</h2>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
      }
    });

    server.listen(port, () => {
      console.log(`\n⏳ Esperando autorización en http://localhost:${port}...`);
    });

    server.on('error', reject);
  });
}

async function main() {
  console.log('\n====================================');
  console.log('  ROKA — Setup Gmail OAuth2');
  console.log('====================================\n');

  const secret = readClientSecret();
  const { client_id, client_secret, redirect_uris } = secret.web;
  const redirectUri = redirect_uris[0];

  console.log(`Client ID: ${client_id}`);
  console.log(`Redirect URI: ${redirectUri}\n`);

  const authUrl = buildAuthUrl(client_id, redirectUri);

  console.log('1. Abre esta URL en tu navegador:');
  console.log(`\n   ${authUrl}\n`);
  console.log('2. Inicia sesión con la cuenta de Gmail que enviará los correos.');
  console.log('3. Acepta los permisos solicitados.');
  console.log('4. Serás redirigido automáticamente y el script capturará el código.\n');

  try {
    const code = await waitForCode(redirectUri);
    console.log('\n✓ Código recibido. Intercambiando por tokens...');

    const tokens = await exchangeCodeForTokens(code, client_id, client_secret, redirectUri);

    console.log('\n====================================');
    console.log('  ✓ Tokens obtenidos exitosamente');
    console.log('====================================\n');
    console.log('Copia estos valores en Configuración → Notificaciones Email:\n');
    console.log(`  Client ID:      ${client_id}`);
    console.log(`  Client Secret:  ${client_secret}`);
    console.log(`  Refresh Token:  ${tokens.refresh_token}`);
    console.log(`  Gmail User:     (la cuenta con la que autorizaste)\n`);

    if (!tokens.refresh_token) {
      console.warn('⚠️  No se recibió refresh_token. Esto puede pasar si ya autorizaste esta app antes.');
      console.warn('   Revoca el acceso en https://myaccount.google.com/permissions y vuelve a ejecutar este script.\n');
    }
  } catch (err: any) {
    console.error('\n✗ Error durante la autorización:', err.message);
    process.exit(1);
  }
}

main();
