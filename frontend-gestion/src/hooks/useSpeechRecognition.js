import { useState, useEffect, useRef } from 'react';

const useSpeechRecognition = ({ lang = 'es-ES', continuous = false, interimResults = false } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Verificar soporte del navegador
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = interimResults;
      recognitionRef.current.lang = lang; // Por defecto español (puedes hacerlo dinámico)

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Error de reconocimiento de voz:", event.error);
        setIsListening(false);
      };
    }
  }, []);
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = interimResults;
    }
  }, [lang, continuous, interimResults]);


  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript(''); // Limpiar anterior
      recognitionRef.current.start();
    } else if (!recognitionRef.current) {
      alert("Tu navegador no soporta reconocimiento de voz. Intenta con Chrome o Edge.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return { 
    isListening, 
    transcript, 
    startListening, 
    stopListening,
    hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
};

export default useSpeechRecognition;