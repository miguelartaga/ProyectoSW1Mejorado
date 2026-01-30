import { ActionIcon, Avatar, Box, Group, Paper, ScrollArea, Text, TextInput, Transition } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { IconCheck, IconCopy, IconMessageChatbot, IconMicrophone, IconMicrophoneOff, IconSend, IconVolume, IconX, IconPhone, IconPhoneOff, IconLanguage } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { getProfile } from '../api/authService';
import WebSocketInstance from '../api/socketService';
import { useAuth } from '../context/AuthContext';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

const ChatWindow = ({ roomName, onClose }) => { 
  const [opened, setOpened] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [myLanguage, setMyLanguage] = useState('es'); 
  
  const viewport = useRef(null);
  const { user } = useAuth();
  const clipboard = useClipboard({ timeout: 2000 });

  const { isListening, transcript, startListening, stopListening, hasSupport } = useSpeechRecognition({
    lang: myLanguage,
    continuous: true,
    interimResults: false,
  });

  const [callActive, setCallActive] = useState(false);
  const [liveTranslateEnabled, setLiveTranslateEnabled] = useState(false);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Obtener idioma preferido del usuario para la voz
  useEffect(() => {
    const fetchLanguage = async () => {
      try {
        const profile = await getProfile();
        const langMap = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'pt': 'pt-BR'
        };
        setMyLanguage(langMap[profile.language_preference] || 'es-ES');
      } catch (error) {
        console.error("No se pudo obtener idioma", error);
      }
    };
    fetchLanguage();
  }, []);

  useEffect(() => {
    if (!transcript) return;
    if (callActive && liveTranslateEnabled) {
      WebSocketInstance.sendMessage({ type: 'transcript', message: transcript });
      return;
    }
    setInputValue((prev) => {
      const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
      return prev + spacer + transcript;
    });
  }, [transcript, callActive, liveTranslateEnabled]);

  // FunciÃ³n para leer texto (Solo manual ahora)
  const speakMessage = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = myLanguage; 
    utterance.rate = 1.0; 
    window.speechSynthesis.speak(utterance);
  };

  // ConexiÃ³n WebSocket
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        WebSocketInstance.sendMessage({
          type: 'signal',
          signal_type: 'ice',
          candidate: event.candidate,
        });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setCallActive(true);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        endCall(false);
      }
    };
    return pc;
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    return stream;
  };

  const startCall = async () => {
    if (callActive) return;
    const stream = await ensureLocalStream();
    const pc = createPeerConnection();
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    WebSocketInstance.sendMessage({
      type: 'signal',
      signal_type: 'offer',
      sdp: offer,
    });
    setCallActive(true);
  };

  const endCall = (sendSignal = true) => {
    if (sendSignal) {
      WebSocketInstance.sendMessage({ type: 'signal', signal_type: 'hangup' });
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setCallActive(false);
  };

  const handleSignal = async (data) => {
    if (data.username === user?.username) return;
    const signal = data.signal || {};
    const signalType = signal.signal_type;
    if (!signalType) return;

    if (signalType === 'offer') {
      const stream = await ensureLocalStream();
      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      WebSocketInstance.sendMessage({
        type: 'signal',
        signal_type: 'answer',
        sdp: answer,
      });
      setCallActive(true);
      return;
    }

    if (signalType === 'answer' && pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      return;
    }

    if (signalType === 'ice' && pcRef.current && signal.candidate) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (err) {
        console.error('ICE error', err);
      }
      return;
    }

    if (signalType === 'hangup') {
      endCall(false);
    }
  };

  const handleLiveTranslation = (data) => {
    setMessages((prev) => [...prev, data]);
    if (callActive && liveTranslateEnabled && data.username !== user?.username) {
      speakMessage(data.message);
    }
  };

  useEffect(() => {
    if (roomName) {
      setOpened(true);
      WebSocketInstance.connect(roomName);
      WebSocketInstance.addCallbacks({
        message: (data) => setMessages((prev) => [...prev, data]),
        signal: handleSignal,
        live_translation: handleLiveTranslation,
      });
    }
    
    return () => {
      WebSocketInstance.disconnect();
      if (isListening) stopListening();
      endCall(false);
      window.speechSynthesis.cancel();
    };
  }, [roomName]); 

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;
    const messageData = { message: inputValue };
    WebSocketInstance.sendMessage(messageData);
    setInputValue('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  const handleClose = () => {
    setOpened(false);
    setTimeout(() => { if (onClose) onClose(); }, 300);
  };

  useEffect(() => {
    if (!callActive || !liveTranslateEnabled) {
      if (isListening) stopListening();
      return;
    }
    if (hasSupport && !isListening) {
      startListening();
    }
  }, [callActive, liveTranslateEnabled, hasSupport, isListening]);

  return (
    <Transition transition="slide-up" mounted={opened}>
      {(styles) => (
        <Paper
          shadow="xl"
          radius="lg"
          style={{
            ...styles,
            position: 'fixed', bottom: 20, right: 20, width: 350, height: 500,
            zIndex: 1001, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', border: '1px solid #eee'
          }}
        >
          {/* Cabecera */}
          <Group justify="space-between" p="md" bg="violet" c="white">
            <Group gap="xs">
              <IconMessageChatbot />
              <Box>
                <Text fw={700} size="sm" style={{ lineHeight: 1.2 }}>Sala: {roomName}</Text>
                <Group gap={4} style={{ cursor: 'pointer', opacity: 0.9 }} onClick={() => clipboard.copy(roomName)}>
                  <Text size="xs" c="gray.2">{clipboard.copied ? 'Â¡Copiado!' : 'Copiar codigo'}</Text>
                  {clipboard.copied ? <IconCheck size={12}/> : <IconCopy size={12}/>}
                </Group>
              </Box>
            </Group>
            <Group gap="xs">
              <ActionIcon variant="transparent" c="white" onClick={callActive ? () => endCall(true) : startCall}>
                {callActive ? <IconPhoneOff /> : <IconPhone />}
              </ActionIcon>
              <ActionIcon variant="transparent" c={liveTranslateEnabled ? "yellow" : "white"} onClick={() => setLiveTranslateEnabled((v) => !v)}>
                <IconLanguage />
              </ActionIcon>
              <ActionIcon variant="transparent" c="white" onClick={handleClose}><IconX /></ActionIcon>
            </Group>
          </Group>

          {/* Ãrea de Mensajes */}
          <ScrollArea viewportRef={viewport} style={{ flex: 1, padding: '15px' }} bg="gray.0">
            {messages.length === 0 && (
              <Text c="dimmed" size="sm" ta="center" mt="xl">
                Sala lista. Comparte el codigo <b>{roomName}</b>.
              </Text>
            )}
            
            {messages.map((msg, index) => {
              const isMe = msg.username === user?.username;
              return (
                <Box key={index} mb="sm" style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && (
                    <Avatar size="sm" radius="xl" color="blue" mr="xs">
                      {msg.username?.[0]?.toUpperCase()}
                    </Avatar>
                  )}
                  <Box
                    bg={isMe ? 'violet' : 'white'}
                    c={isMe ? 'white' : 'black'}
                    style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: '12px',
                      borderBottomRightRadius: isMe ? 0 : 12, borderBottomLeftRadius: !isMe ? 0 : 12,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                  >
                    {!isMe && (
                      <Group justify="space-between" mb={2}>
                          <Text size="xs" c="dimmed">{msg.username}</Text>
                          {/* BotÃ³n para escuchar MANUALMENTE */}
                          <ActionIcon size="xs" variant="transparent" color="blue" onClick={() => speakMessage(msg.message)}>
                            <IconVolume size={14} />
                          </ActionIcon>
                      </Group>
                    )}
                    <Text size="sm">
                      {msg.type === 'live_translation' ? '🗣️ ' : ''}
                      {msg.message}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </ScrollArea>

          <audio ref={remoteAudioRef} autoPlay />
          {/* Input Area */}
          <Box p="md" style={{ borderTop: '1px solid #eee' }}>
            <Group gap="xs">
              {hasSupport && (
                <ActionIcon
                  variant={isListening ? "filled" : "light"} 
                  color={isListening ? "red" : "gray"}
                  size="lg"
                  onClick={isListening ? stopListening : startListening}
                  style={isListening ? { animation: 'pulse 2s infinite' } : {}}
                >
                  {isListening ? <IconMicrophoneOff size={18} /> : <IconMicrophone size={18} />}
                </ActionIcon>
              )}
              <TextInput 
                placeholder={isListening ? "Escuchando..." : "Escribe..."}
                style={{ flex: 1 }}
                value={inputValue}
                onChange={(e) => setInputValue(e.currentTarget.value)}
                onKeyDown={handleKeyPress}
              />
              <ActionIcon variant="filled" color="violet" size="lg" onClick={handleSendMessage} disabled={!inputValue.trim()}>
                <IconSend size={18} />
              </ActionIcon>
            </Group>
          </Box>
        </Paper>
      )}
    </Transition>
  );
};

export default ChatWindow;
