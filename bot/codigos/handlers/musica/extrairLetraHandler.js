// 🎵 EXTRATOR DE LETRA — transcreve o áudio citado e mostra a letra
import axios from 'axios';
import FormData from 'form-data';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { Jimp } from 'jimp';

const MISTRAL_API_KEY   = process.env.MISTRAL_API_KEY;
const TRANSCRIPTION_URL = 'https://api.mistral.ai/v1/audio/transcriptions';
const CHAT_URL          = 'https://api.mistral.ai/v1/chat/completions';

const RODAPE = `©𝘋𝘢𝘮𝘢𝘴 𝘥𝘢 𝘕𝘪𝘨𝘩𝘵`;
const TITULO = `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸`;
const BANNER_URL = 'https://i.ibb.co/JRNRP1Qd/letras-810k.png';

// ⏱️ LIMITE MÁXIMO DE DURAÇÃO (em segundos)
const DURACAO_MAXIMA_SEGUNDOS = 7 * 60; // 7 minutos

// ============================================
// ✅ RESOLVER SENDER REAL
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
// 🖼️ GERA THUMBNAIL
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
// 🖼️ BAIXA O BANNER
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
// 🎙️ TRANSCREVE O ÁUDIO
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
// 📝 FORMATA A LETRA EM VERSOS/ESTROFES
// ============================================
async function formatarLetra(textoBruto) {
    try {
        const { data } = await axios.post(
            CHAT_URL,
            {
                model: 'mistral-small-latest',
                messages: [
                    {
                        role: 'system',
                        content:
                            'Você recebe a transcrição bruta de uma letra de música, sem quebras de linha. ' +
                            'Sua única tarefa é reorganizar o MESMO texto em versos e estrofes (separadas por linha em branco), ' +
                            'como normalmente aparece em letras de música. ' +
                            'NÃO corrija, reescreva, resuma, traduza ou adicione palavras. ' +
                            'NÃO adicione títulos, comentários ou explicações. ' +
                            'Responda APENAS com a letra formatada.',
                    },
                    { role: 'user', content: textoBruto },
                ],
                max_tokens: 1000,
                temperature: 0,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${MISTRAL_API_KEY}`,
                },
                timeout: 20000,
            }
        );

        const formatado = data?.choices?.[0]?.message?.content?.trim();
        return formatado || textoBruto;
    } catch (err) {
        console.error('⚠️ Erro ao formatar letra, usando texto bruto:', err.message);
        return textoBruto; // fallback: se der erro, manda o texto corrido mesmo
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
// 🎯 ENTRADA PRINCIPAL — #letra
// ============================================
export async function handleLetra(sock, message, content, from) {
    const lower = content.toLowerCase().trim();
    if (lower !== '#letra') return false;

    const quotedInfo    = message.message?.extendedTextMessage?.contextInfo;
    const quotedMessage = quotedInfo?.quotedMessage;
    const audioMsg      = quotedMessage?.audioMessage;

    const senderId = resolverSenderId(message);
    const nomeQuemPediu = `@${senderId.split('@')[0]}`;

    const replyContext = {
        stanzaId: message.key.id,
        participant: message.key.participant || message.key.remoteJid,
        quotedMessage: message.message
    };

    if (!audioMsg) {
        await sock.sendMessage(from, {
            text: `${nomeQuemPediu}\n\n⚠️ Dê *reply* em um áudio de música e mande *#letra*.\n\n${RODAPE}`,
            mentions: [senderId],
            quoted: message
        });
        return true;
    }

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
        // ── 1. POSTER (BANNER) ──────────────────────────
        const bannerBuffer = await baixarBanner();

        const captionAviso =
            `🅟🅡🅔🅟🅐🅡🅐🅝🅓🅞 🅢🅤🅐 🅛🅔🅣🅡🅐!\n\n` +
            `👤 ${nomeQuemPediu} solicitou a letra da música.\n` +
            `🎼 Analisando o áudio...\n` +
            `📝 Transcrevendo a letra...\n\n` +
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
                console.warn('⚠️ Falha ao enviar poster:', e.message);
                await sock.sendMessage(from, {
                    text: captionAviso,
                    mentions: [senderId],
                    quoted: message
                });
            }
        } else {
            await sock.sendMessage(from, {
                text: captionAviso,
                mentions: [senderId],
                quoted: message
            });
        }

        // ── 2. BAIXA ÁUDIO ──────────────────────────────
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

        const letraBruta = await transcreverAudio(buffer);

        if (!letraBruta) {
            await sock.sendMessage(from, {
                text: `${nomeQuemPediu}\n\n❌ Não consegui transcrever esse áudio.\n\n${RODAPE}`,
                mentions: [senderId],
                quoted: message
            });
            return true;
        }

        // ── 2.1 FORMATA A LETRA EM VERSOS/ESTROFES ──────
        const letra = await formatarLetra(letraBruta);

        // ── 3. ENVIA A LETRA ─────────────────────────────
        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(from, {
            text:
                `${TITULO}\n` +
                `#musicaboa 🔥 Não tem idade, tem atitude 💃 #damasdanight #amizade #liberdade #diversao #atitude\n\n` +
                `🎼📖 𝐋𝐄𝐓𝐑𝐀 𝐏𝐄𝐃𝐈𝐃𝐀 𝐏𝐎𝐑 ${nomeQuemPediu} 🎼📖\n\n` +
                `${letra}\n\n` +
                `_🍋🧂🥃 Se a vida te der limão, pede sal e tequila e se joga! 🎉_\n\n` +
                `${RODAPE}`,
            mentions: [senderId]
        });

    } catch (err) {
        console.error('❌ [#letra] Erro:', err.message);
        await sock.sendMessage(from, {
            text: `${nomeQuemPediu}\n\n❌ Erro ao processar a letra da música. Tente novamente.\n\n${RODAPE}`,
            mentions: [senderId],
            quoted: message
        });
    }

    return true;
}