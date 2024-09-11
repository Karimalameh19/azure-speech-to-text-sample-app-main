import React, { useState, useRef, useEffect } from 'react';
import Button from '@mui/material/Button';
import MicIcon from '@mui/icons-material/Mic';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { getTokenOrRefresh } from './utils/getTokenOrRefresh';
import './App.css';

const speechsdk = require('microsoft-cognitiveservices-speech-sdk');

function App() {
  const recognizerRef = useRef(null);
  const [displayText, setDisplayText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const recordingIntervalRef = useRef(null);

  // Language states
  const [speechLanguage, setSpeechLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('es');

  useEffect(() => {
    if (recordingActive) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTimer((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(recordingIntervalRef.current);
      setRecordingTimer(0);
    }
  }, [recordingActive]);

  useEffect(() => {
    if (recordingActive) {
      const refreshInterval = setInterval(async () => {
        const tokenObj = await getTokenOrRefresh();
        recognizerRef.current.authToken = tokenObj.authToken;
      }, 9 * 60 * 1000); // 9 minutes
      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [recordingActive]);

  // Handle language change
  const handleLanguageChange = (setter) => (event) => {
    const newLanguage = event.target.value;
    setter(newLanguage);

    if (recordingActive) {
      // Stop and restart recognition to apply new language
      stopRecognition(() => startRecognition());
    }
  };

  function onSessionStarted(sender, sessionEventArgs) {
    setRecordingActive(true);
  }

  function onSessionStopped(sender, sessionEventArgs) {
    setRecordingActive(false);
  }

  async function startRecognition() {
    const tokenObj = await getTokenOrRefresh();
    const translationConfig = speechsdk.SpeechTranslationConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
    translationConfig.speechRecognitionLanguage = speechLanguage; // Source language from state
    translationConfig.addTargetLanguage(targetLanguage); // Target language from state

    const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
    recognizerRef.current = new speechsdk.TranslationRecognizer(translationConfig, audioConfig);

    recognizerRef.current.recognizing = (sender, event) => {
      const translatedText = event.result.translations.get(targetLanguage); // Get translation in the target language
      const recognizedText = event.result.text;
      if (recognizedText) {
        setInterimText(`${recognizedText} (Translated: ${translatedText})`);
      }
    };

    recognizerRef.current.recognized = (sender, event) => {
      const translatedText = event.result.translations.get(targetLanguage);
      const recognizedText = event.result.text;
      if (recognizedText) {
        setDisplayText((prevDisplayText) => `${prevDisplayText} ${recognizedText} (Translated: ${translatedText})`);
        setInterimText('');
      }
    };

    recognizerRef.current.sessionStarted = onSessionStarted;
    recognizerRef.current.sessionStopped = onSessionStopped;

    recognizerRef.current.startContinuousRecognitionAsync();
  }

  function stopRecognition(callback) {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        function () {
          recognizerRef.current.close();
          recognizerRef.current = null;
          if (callback) callback();
        },
        function (err) {
          console.log('ERROR: ' + err);
        }
      );
    }
  }

  function sttFromMic() {
    if (!recordingActive) {
      startRecognition();
    } else {
      stopRecognition();
    }
  }

  return (
    <div className="App">
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <Box sx={{ bgcolor: 'primary.main', color: 'white' }} padding={1}>
            <Typography variant="h4">Azure Speech to Text with Real-Time Translation</Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={2}>
          <Box margin={2} display="flex" justifyContent="center">
            <Button
              variant="contained"
              onClick={sttFromMic}
              startIcon={recordingActive ? <StopCircleIcon /> : <MicIcon />}
              color={recordingActive ? 'error' : 'primary'}
            >
              {recordingActive
                ? `${recordingTimer / 60 < 10 ? '0' : ''}${Math.floor(recordingTimer / 60)}:${recordingTimer % 60 < 10 ? '0' : ''}${recordingTimer % 60}`
                : 'Start'}
            </Button>
          </Box>
        </Grid>
        <Grid item xs={12} sm={10}>
          <Box margin={2}>
            <TextField
              fullWidth
              id="outlined-multiline-flexible"
              label="Speech Output"
              multiline
              minRows={4}
              value={recordingActive ? displayText + ' ' + interimText : displayText}
              onChange={(event) => {
                setDisplayText(event.target.value);
              }}
              disabled={recordingActive} // Disable editing while recording is active
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box margin={2}>
            <Typography variant="h6">Speech Recognition Language</Typography>
            <Select
              value={speechLanguage}
              onChange={handleLanguageChange(setSpeechLanguage)}
              fullWidth
            >
              <MenuItem value="en-US">English (US)</MenuItem>
              <MenuItem value="ar-LB">Arabic (Lebanon)</MenuItem>
              <MenuItem value="zh-CN">Chinese (Simplified)</MenuItem>
              <MenuItem value="de-DE">German</MenuItem>
              {/* Add more languages as needed */}
            </Select>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box margin={2}>
            <Typography variant="h6">Target Language for Translation</Typography>
            <Select
              value={targetLanguage}
              onChange={handleLanguageChange(setTargetLanguage)}
              fullWidth
            >
              <MenuItem value="es">Spanish</MenuItem>
              <MenuItem value="fr">French</MenuItem>
              <MenuItem value="de">German</MenuItem>
              <MenuItem value="zh-Hans">Chinese (Simplified)</MenuItem>
              {/* Add more languages as needed */}
            </Select>
          </Box>
        </Grid>
      </Grid>
    </div>
  );
}

export default App;
