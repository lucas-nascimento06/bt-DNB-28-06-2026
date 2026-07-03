// 🌍 TRADUTOR DE MÚSICA — transcreve o áudio citado e traduz a letra
import axios from 'axios';
import FormData from 'form-data';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

const MISTRAL_API_KEY   = process.env.MISTRAL_API_KEY;
const TRANSCRIPTION_URL = 'https://api.mistral.ai/v1/audio/transcriptions';
const CHAT_URL          = 'https://api.mistral.ai/v1/chat/completions';

const RODAPE = `©𝘋𝘢𝘮𝘢𝘴 𝘥𝘢 𝘕𝘪𝘨𝘩𝘵`;
const TITULO = `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸`;
const BANNER_URL = 'https://i.ibb.co/xKnNHym1/banner-tradutor.png';

// ⏱️ LIMITE MÁXIMO DE DURAÇÃO (em segundos)
const DURACAO_MAXIMA_SEGUNDOS = 7 * 60; // 7 minutos

// ============================================
// 🎙️ TRANSCREVE O ÁUDIO (Voxtral)
// ============================================
async function transcreverAudio(buffer) {
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.mp3' });
    form.append('model', 'voxtral-mini-latest');

    const { data } = await axios.post(TRANSCRIPTION_URL, form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${MISTRAL_API_KEY}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    });

    return data?.text?.trim() || null;
}

// ============================================
// 🌍 TRADUZ O TEXTO TRANSCRITO
// ============================================
async function traduzirTexto(texto) {
    const { data } = await axios.post(
        CHAT_URL,
        {
            model: 'mistral-small-latest',
            messages: [
                {
                    role: 'system',
                    content:
                        'Você é um tradutor. Traduza o texto do usuário (letra de música) para português do Brasil, mantendo o sentido e, quando possível, o tom poético. Responda APENAS com a tradução, sem comentários nem explicações.',
                },
                { role: 'user', content: texto },
            ],
            max_tokens: 1000,
            temperature: 0.3,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${MISTRAL_API_KEY}`,
            },
        }
    );

    return data.choices?.[0]?.message?.content?.trim() || null;
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

    if (!audioMsg) {
        await sock.sendMessage(from, {
            text: `⚠️ Dê *reply* em um áudio de música e mande *#traduz*.\n\n${RODAPE}`,
        }, { quoted: message });
        return true;
    }

    // ⏱️ CHECA DURAÇÃO ANTES DE BAIXAR (economiza processamento)
    const duracaoSegundos = audioMsg.seconds || 0;

    if (duracaoSegundos > DURACAO_MAXIMA_SEGUNDOS) {
        await sock.sendMessage(from, {
            text:
                `⚠️ Esse áudio tem *${formatarDuracao(duracaoSegundos)}*, e o limite é de *${formatarDuracao(DURACAO_MAXIMA_SEGUNDOS)}*.\n\n` +
                `Manda um trecho menor ou uma versão mais curta da música. 🎧\n\n${RODAPE}`,
        }, { quoted: message });
        return true;
    }

    try {
        // 1️⃣ Banner + Título + aviso de processamento (fica na tela, não é apagada depois)
        await sock.sendMessage(from, {
            image: { url: BANNER_URL },
            caption: `${TITULO}\n\n🎧 Transcrevendo e traduzindo a música, aguarde... ⏳`,
        }, { quoted: message });

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
                text: `❌ Não consegui transcrever esse áudio.\n\n${RODAPE}`,
            }, { quoted: message });
            return true;
        }

        const traducao = await traduzirTexto(letraOriginal);

        if (!traducao) {
            await sock.sendMessage(from, {
                text: `❌ Não consegui traduzir a letra.\n\n${RODAPE}`,
            }, { quoted: message });
            return true;
        }

        // 2️⃣ Letra traduzida (mensagem final, separada do banner)
        await sock.sendMessage(from, {
            text:
                `${TITULO}\n` +
                `#musicaboa 🔥 Não tem idade, tem atitude 💃 #damasdanight #amizade #liberdade #diversao #atitude\n\n` +
                `🎼📚 *Sua música traduzida* 🎼📚\n` +
                `${traducao}\n\n` +
                `_🍋🧂🥃 Se a vida te der limão, pede sal e tequila e se joga! 🎉_\n\n` +
                `${RODAPE}`,
        });

    } catch (err) {
        console.error('❌ [#traduz] Erro:', err.message);
        await sock.sendMessage(from, {
            text: `❌ Erro ao processar a tradução da música. Tente novamente.\n\n${RODAPE}`,
        }, { quoted: message });
    }

    return true;
}