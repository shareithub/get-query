const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ASCII Art Intro
const intro = `
 ________  ________  ___     
|\\   __  \\|\\   __  \\|\\  \\    
\\ \\  \\|\\  \\ \\  \\|\\  \\ \\  \\   
 \\ \\   __  \\ \\   __  \\ \\  \\  
  \\ \\  \\ \\  \\ \\  \\ \\  \\ \\  \\ 
   \\ \\__\\ \\__\\ \\__\\ \\__\\ \\__\\
    \\|__|\\|__|\\|__|\\|__|\\|__|
                             
                             
                             
Join channel telegram : t.me/allabout_internet
`;

const apiId = 25508546;
const apiHash = '196bf26d00f385160a37f0019a84f4c6'; // Pastikan apiHash adalah string

// Setup readline untuk input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

const accounts = new Map(); // Menyimpan sesi aktif untuk beberapa akun

async function loginWithPhoneNumber() {
  const phoneNumber = await askQuestion('Silakan masukkan nomor telepon Anda (dengan kode negara, misalnya +1234567890): ');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.connect();
  await client.start({
    phoneNumber: async () => phoneNumber,
    phoneCode: async () => await askQuestion('Silakan masukkan kode yang Anda terima: '),
    password: async () => await askQuestion('Silakan masukkan kata sandi Anda (jika diperlukan): '),
    onError: (err) => console.log('Error:', err),
  });

  console.log('Anda sekarang terhubung.');

  const sessionString = client.session.save();
  const sessionFolderPath = 'session';
  const sanitizedPhoneNumber = phoneNumber.replace(/\D/g, '');
  const sessionFilePath = path.join(sessionFolderPath, `${sanitizedPhoneNumber}.session`);

  // Cek apakah folder "session" ada, jika tidak, buat folder
  if (!fs.existsSync(sessionFolderPath)) {
    fs.mkdirSync(sessionFolderPath, { recursive: true });
    console.log(`Folder "${sessionFolderPath}" dibuat.`);
  }

  // Simpan string sesi ke file .session
  fs.writeFileSync(sessionFilePath, sessionString, 'utf8');
  console.log(`String sesi disimpan ke ${sessionFilePath}`);

  // Tambahkan akun ke peta
  accounts.set(phoneNumber, client);
}

async function loginWithSessionFile() {
  const sessionFolderPath = 'session';

  if (!fs.existsSync(sessionFolderPath) || fs.readdirSync(sessionFolderPath).length === 0) {
    console.log('Folder "session" kosong atau tidak ada.');
    return;
  }

  const sessionFiles = fs.readdirSync(sessionFolderPath).filter(file => file.endsWith('.session'));

  if (sessionFiles.length === 0) {
    console.log('Tidak ada file sesi yang ditemukan.');
    return;
  }

  console.log('Pilih file sesi untuk login atau login semua:');
  console.log('0. Login semua file sesi');
  sessionFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });

  const choice = parseInt(await askQuestion('Masukkan nomor file sesi yang ingin digunakan (atau 0 untuk semua): '), 10);

  if (choice === 0) {
    // Login semua file sesi
    for (const file of sessionFiles) {
      const sessionFilePath = path.join(sessionFolderPath, file);
      const sessionString = fs.readFileSync(sessionFilePath, 'utf8');
      const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
        connectionRetries: 5,
      });

      await client.connect();
      const phoneNumber = file.replace('.session', '');
      console.log(`Terhubung menggunakan file sesi: ${file}`);
      accounts.set(phoneNumber, client);
    }
  } else {
    const selectedFile = sessionFiles[choice - 1];

    if (!selectedFile) {
      console.log('Pilihan tidak valid.');
      return;
    }

    const sessionFilePath = path.join(sessionFolderPath, selectedFile);
    const sessionString = fs.readFileSync(sessionFilePath, 'utf8');
    const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();
    const phoneNumber = selectedFile.replace('.session', '');
    console.log(`Anda terhubung menggunakan file sesi: ${selectedFile}`);
    accounts.set(phoneNumber, client);
  }
}

async function requestWebViewForClient(client, phoneNumber, peer, bot, url) {
  try {
    const result = await client.invoke(
      new Api.messages.RequestWebView({
        peer,
        bot,
        fromBotMenu: false,
        url,
        platform: 'android',
      })
    );

    const urlData = result.url
      .split('#')[1]
      .split('&')[0]
      .split('tgWebAppData=')[1];

    const decodedUrlData = decodeURIComponent(urlData);

    const queryFolderPath = 'query';
    const sanitizedPhoneNumber = phoneNumber.replace(/\D/g, '');
    const queryFilePath = path.join(queryFolderPath, `${sanitizedPhoneNumber}.txt`);

    // Cek apakah folder "query" ada, jika tidak, buat folder
    if (!fs.existsSync(queryFolderPath)) {
      fs.mkdirSync(queryFolderPath, { recursive: true });
      console.log(`Folder "${queryFolderPath}" dibuat.`);
    }

    // Format hasil
    const formattedResult = `${bot} ${peer} | ${decodedUrlData}\n`;

    // Tambahkan hasil yang diformat ke file .txt
    fs.appendFileSync(queryFilePath, formattedResult, 'utf8');
    console.log(`Hasil ditambahkan ke ${queryFilePath}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

async function requestWebViewForAllClients() {
  if (accounts.size === 0) {
    console.log('Tidak ada akun yang terdaftar. Harap login terlebih dahulu.');
    return;
  }

  const peer = await askQuestion('Silakan masukkan peer (misalnya, @BlumCryptoBot): ');
  const bot = await askQuestion('Silakan masukkan bot (misalnya, @BlumCryptoBot): ');
  const url = await askQuestion('Silakan masukkan URL (misalnya, https://t.me/BlumCryptoBot/app?startapp=ref_VhiCTSvEcI): ');

  for (const [phoneNumber, client] of accounts.entries()) {
    console.log(`Memproses akun ${phoneNumber}...`);
    await requestWebViewForClient(client, phoneNumber, peer, bot, url);
  }
}

async function logoutClient(client) {
  try {
    await client.disconnect();
    console.log('Akun berhasil dikeluarkan.');
  } catch (error) {
    console.error('Gagal mengeluarkan akun:', error);
  }
}

async function main() {
  console.log('SELAMAT DATANG DI TOOLS !!');
  console.log(intro); // Menampilkan ASCII Art Intro
  let globalPeer, globalBot, globalUrl;

  while (true) {
    console.log('\nMenu Utama:');
    console.log('1. Login dengan Nomor Telepon');
    console.log('2. Request WebView untuk Semua Akun');
    console.log('3. Ulangi Request WebView untuk Akun Terpilih');
    console.log('4. Login dengan File Sesi');
    console.log('5. Keluar');

    const mainChoice = await askQuestion('Silakan pilih opsi (1/2/3/4/5): ');

    if (mainChoice === '1') {
      await loginWithPhoneNumber();

    } else if (mainChoice === '2') {
      await requestWebViewForAllClients();

    } else if (mainChoice === '3') {
      if (accounts.size === 0) {
        console.log('Tidak ada akun yang terdaftar. Harap login terlebih dahulu.');
        continue;
      }

      const phoneNumber = await askQuestion('Silakan pilih nomor telepon dari daftar akun yang terdaftar: ');

      if (accounts.has(phoneNumber)) {
        const client = accounts.get(phoneNumber);
        if (!globalPeer || !globalBot || !globalUrl) {
          console.log('Silakan masukkan informasi untuk request WebView:');
          globalPeer = await askQuestion('Silakan masukkan peer (misalnya, @BlumCryptoBot): ');
          globalBot = await askQuestion('Silakan masukkan bot (misalnya, @BlumCryptoBot): ');
          globalUrl = await askQuestion('Silakan masukkan URL (misalnya, https://t.me/BlumCryptoBot/app?startapp=ref_VhiCTSvEcI): ');
        }
        await requestWebViewForClient(client, phoneNumber, globalPeer, globalBot, globalUrl);
      } else {
        console.log('Akun tidak ditemukan. Silakan login terlebih dahulu.');
      }

    } else if (mainChoice === '4') {
      await loginWithSessionFile();

    } else if (mainChoice === '5') {
      console.log('Keluar dan menghentikan bot...');
      // Hentikan semua akun yang terdaftar
      for (const [phoneNumber, client] of accounts.entries()) {
        await logoutClient(client);
      }
      // Tutup readline
      rl.close();
      break;

    } else {
      console.log('Pilihan tidak valid. Silakan pilih lagi.');
    }
  }
}

main();

