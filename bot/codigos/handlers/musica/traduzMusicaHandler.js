// 🌍 TRADUTOR DE MÚSICA — transcreve o áudio citado e traduz a letra
import axios from 'axios';
import FormData from 'form-data';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { Jimp } from 'jimp';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

const MISTRAL_API_KEY   = process.env.MISTRAL_API_KEY;
const TRANSCRIPTION_URL = 'https://api.mistral.ai/v1/audio/transcriptions';
const CHAT_URL          = 'https://api.mistral.ai/v1/chat/completions';

const RODAPE = `©𝘋𝘢𝘮𝘢𝘴 𝘥𝘢 𝘕𝘪𝘨𝘩𝘵`;
const TITULO = `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸`;
const BANNER_URL = 'https://i.ibb.co/Tx330HzG/tradu-ao-musicas.png';

// ⏱️ LIMITE MÁXIMO DE DURAÇÃO (em segundos)
const DURACAO_MAXIMA_SEGUNDOS = 7 * 60; // 7 minutos

// 🌍 Idioma alvo da tradução
const IDIOMA_ALVO = 'português do Brasil';

// ============================================
// ✅ RESOLVER SENDER REAL (evita @lid e JID de grupo) — igual dedicatoriaHandler
// ============================================
function resolverSenderId(message) {
    const key = message.key;
    if (key.participantAlt && key.participantAlt.endsWith('@s.whatsapp.net')) {
        return key.participantAlt;
    }
    if (key.participant && key.participant.endsWith('@s.whatsapp.net')) {
        return key.participant;
    }
    return key.participant || key.remoteJid;
}

// ============================================
// 🖼️ GERA THUMBNAIL (igual dedicatoriaHandler)
// ============================================
async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        image.scaleToFit({ w: size, h: size });
        return await image.getBuffer("image/jpeg");
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

// ============================================
// 🖼️ BAIXA O BANNER MANUALMENTE (evita falha do fetch interno do Baileys)
// ============================================
async function baixarBanner() {
    try {
        const response = await axios.get(BANNER_URL, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
            maxRedirects: 5
        });
        const buffer = Buffer.from(response.data, 'binary');
        if (buffer.length < 1000) {
            console.warn('⚠️ Banner baixado parece inválido (muito pequeno)');
            return null;
        }
        return buffer;
    } catch (err) {
        console.error('❌ Erro ao baixar banner:', err.message);
        return null;
    }
}

// ============================================
// 🔧 CONVERTE O ÁUDIO PARA MP3 REAL (via ffmpeg)
// ============================================
// O áudio de voz/mensagem do WhatsApp normalmente vem em OGG/Opus.
// Antes ele era enviado direto pro Mistral com o nome "audio.mp3" sem
// nenhuma conversão real — o que pode causar erro de decodificação,
// cortes/perdas no meio do áudio e piorar (e muito) a transcrição —
// e por consequência a tradução, que parte desse texto.
async function converterParaMp3(bufferEntrada) {
    const tmpDir = os.tmpdir();
    const id = randomUUID();
    const entradaPath = path.join(tmpDir, `${id}-in.ogg`);
    const saidaPath   = path.join(tmpDir, `${id}-out.mp3`);

    try {
        await fs.writeFile(entradaPath, bufferEntrada);

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-y',                 // sobrescreve se existir
                '-i', entradaPath,    // entrada
                '-ar', '16000',       // 16kHz é suficiente e ideal pra ASR
                '-ac', '1',           // mono
                '-b:a', '128k',       // bitrate razoável
                '-f', 'mp3',
                saidaPath
            ]);

            let stderr = '';
            ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });

            ffmpeg.on('error', (err) => {
                reject(new Error(`ffmpeg não encontrado ou falhou ao iniciar: ${err.message}`));
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg saiu com código ${code}: ${stderr.slice(-500)}`));
                }
            });
        });

        const bufferSaida = await fs.readFile(saidaPath);
        return bufferSaida;

    } finally {
        // limpeza dos temporários, não deixa lixo acumulando
        await fs.unlink(entradaPath).catch(() => {});
        await fs.unlink(saidaPath).catch(() => {});
    }
}

// ============================================
// 🎙️ TRANSCREVE O ÁUDIO (Voxtral)
// ============================================
async function transcreverAudio(bufferOriginal) {
    // Converte pra um MP3 real antes de mandar — corrige o principal
    // motivo de transcrições incompletas/erradas (formato incompatível).
    let bufferParaEnviar;
    let nomeArquivo;

    try {
        bufferParaEnviar = await converterParaMp3(bufferOriginal);
        nomeArquivo = 'audio.mp3';
    } catch (err) {
        console.warn('⚠️ Falha ao converter áudio com ffmpeg, enviando original:', err.message);
        bufferParaEnviar = bufferOriginal;
        nomeArquivo = 'audio.ogg';
    }

    const form = new FormData();
    form.append('file', bufferParaEnviar, { filename: nomeArquivo });
    form.append('model', 'voxtral-mini-latest');

    const { data } = await axios.post(TRANSCRIPTION_URL, form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${MISTRAL_API_KEY}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000,
    });

    return data?.text?.trim() || null;
}

// ============================================
// 🌍 TRADUZ O TEXTO TRANSCRITO
// ============================================
async function traduzirTexto(texto) {
    try {
        const { data } = await axios.post(
            CHAT_URL,
            {
                model: 'mistral-small-latest',
                messages: [
                    {
                        role: 'system',
                        content:
                            `Você é um tradutor. Traduza o texto do usuário (letra de música) INTEGRALMENTE para ${IDIOMA_ALVO}, ` +
                            'mantendo o sentido e, quando possível, o tom poético. ' +
                            'Traduza TODAS as estrofes, do início ao fim, sem pular ou resumir nenhuma parte. ' +
                            'Responda APENAS com a tradução completa, sem comentários nem explicações.',
                    },
                    { role: 'user', content: texto },
                ],
                // ⬆️ Antes era 1000 — cortava traduções de músicas mais longas
                // no meio do texto. Aumentado com folga pra letras longas.
                max_tokens: 4000,
                temperature: 0.3,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${MISTRAL_API_KEY}`,
                },
                timeout: 30000,
            }
        );

        const choice = data.choices?.[0];
        let traducao = choice?.message?.content?.trim() || null;

        // Se o modelo ainda assim cortou por atingir o limite de tokens,
        // loga um aviso pra facilitar diagnóstico (em vez de mandar cortado
        // sem ninguém perceber o motivo).
        if (choice?.finish_reason === 'length') {
            console.warn('⚠️ Tradução pode ter sido cortada por limite de tokens (finish_reason=length).');
        }

        return traducao;
    } catch (err) {
        console.error('❌ Erro ao traduzir texto:', err.message);
        return null;
    }
}

// ============================================
// 🕐 FORMATA SEGUNDOS EM MM:SS
// ============================================
function formatarDuracao(segundos) {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
}

// ============================================
// 🎯 ENTRADA PRINCIPAL — #traduz
// ============================================
export async function handleTraduzMusica(sock, message, content, from) {
    const lower = content.toLowerCase().trim();
    if (lower !== '#traduz') return false;

    const quotedInfo    = message.message?.extendedTextMessage?.contextInfo;
    const quotedMessage = quotedInfo?.quotedMessage;
    const audioMsg      = quotedMessage?.audioMessage;

    // ✅ Quem pediu a tradução (para marcar/mencionar, igual dedicatoriaHandler)
    const senderId = resolverSenderId(message);
    const nomeQuemPediu = `@${senderId.split('@')[0]}`;

    // ✅ contexto de reply (mesmo padrão do dedicatoriaHandler)
    const replyContext = {
        stanzaId: message.key.id,
        participant: message.key.participant || message.key.remoteJid,
        quotedMessage: message.message
    };

    if (!audioMsg) {
        await sock.sendMessage(from, {
            text: `${nomeQuemPediu}\n\n⚠️ Dê *reply* em um áudio de música e mande *#traduz*.\n\n${RODAPE}`,
            mentions: [senderId],
            quoted: message
        });
        return true;
    }

    // ⏱️ CHECA DURAÇÃO ANTES DE BAIXAR (economiza processamento)
    const duracaoSegundos = audioMsg.seconds || 0;

    if (duracaoSegundos > DURACAO_MAXIMA_SEGUNDOS) {
        await sock.sendMessage(from, {
            text:
                `${nomeQuemPediu}\n\n⚠️ Esse áudio tem *${formatarDuracao(duracaoSegundos)}*, e o limite é de *${formatarDuracao(DURACAO_MAXIMA_SEGUNDOS)}*.\n\n` +
                `Manda um trecho menor ou uma versão mais curta da música. 🎧\n\n${RODAPE}`,
            mentions: [senderId],
            quoted: message
        });
        return true;
    }

    try {
        // ── 1. POSTER (BANNER) MENCIONANDO A PESSOA ──────────────────────────
        const bannerBuffer = await baixarBanner();

        const captionAviso =
            `🅟🅡🅔🅟🅐🅡🅐🅝🅓🅞 🅢🅤🅐 🅣🅡🅐🅓🅤🅒🅐🅞!\n\n` +
            `👤 ${nomeQuemPediu} solicitou a tradução de uma música.\n` +
            `🎼 Analisando o áudio...\n` +
            `📝 Transcrevendo a letra...\n` +
            `🌐 Traduzindo com precisão...\n\n` +
            `⏳ Aguarde, o resultado será enviado em instantes.`;

        if (bannerBuffer) {
            const thumb = await gerarThumbnail(bannerBuffer, 256);
            try {
                await sock.sendMessage(from, {
                    image: bannerBuffer,
                    caption: captionAviso,
                    mentions: [senderId],
                    jpegThumbnail: thumb,
                    contextInfo: replyContext
                });
            } catch (e) {
                console.warn('⚠️ Falha ao enviar poster, enviando texto:', e.message);
                await sock.sendMessage(from, {
                    text: captionAviso,
                    mentions: [senderId],
                    quoted: message
                });
            }
        } else {
            console.warn('⚠️ [#traduz] Banner indisponível, enviando aviso em texto.');
            await sock.sendMessage(from, {
                text: captionAviso,
                mentions: [senderId],
                quoted: message
            });
        }

        // Monta uma "mensagem falsa" pro Baileys conseguir baixar a mídia citada
        const fakeMessage = {
            key: {
                remoteJid: from,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant,
            },
            message: quotedMessage,
        };

        const buffer = await downloadMediaMessage(
            fakeMessage,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Buffer de áudio vazio');
        }

        const letraOriginal = await transcreverAudio(buffer);

        if (!letraOriginal) {
            await sock.sendMessage(from, {
                text: `${nomeQuemPediu}\n\n❌ Não consegui transcrever esse áudio.\n\n${RODAPE}`,
                mentions: [senderId],
                quoted: message
            });
            return true;
        }

        const traducao = await traduzirTexto(letraOriginal);

        if (!traducao) {
            await sock.sendMessage(from, {
                text: `${nomeQuemPediu}\n\n❌ Não consegui traduzir a letra.\n\n${RODAPE}`,
                mentions: [senderId],
                quoted: message
            });
            return true;
        }

        // ── 2. LETRA TRADUZIDA (mensagem final, marcando quem pediu) ─────────
        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(from, {
            text:
                `${TITULO}\n` +
                `#musicaboa 🔥 Não tem idade, tem atitude 💃 #damasdanight #amizade #liberdade #diversao #atitude\n\n` +
                `🎼📚 𝐓𝐑𝐀𝐃𝐔𝐂𝐀𝐎 𝐏𝐄𝐃𝐈𝐃𝐀 𝐏𝐎𝐑 ${nomeQuemPediu} 🎼📚\n\n` +
                `${traducao}\n\n` +
                `_🍋🧂🥃 Se a vida te der limão, pede sal e tequila e se joga! 🎉_\n\n` +
                `${RODAPE}`,
            mentions: [senderId]
        });

    } catch (err) {
        console.error('❌ [#traduz] Erro:', err.message);
        await sock.sendMessage(from, {
            text: `${nomeQuemPediu}\n\n❌ Erro ao processar a tradução da música. Tente novamente.\n\n${RODAPE}`,
            mentions: [senderId],
            quoted: message
        });
    }

    return true;
}