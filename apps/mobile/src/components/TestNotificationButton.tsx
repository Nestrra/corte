import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, errorText } from '../api/errors';
import { sendTestNotification } from '../api/notifications';
import { spacing, type ColorToken } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

interface Message {
  text: string;
  color: ColorToken;
}

/**
 * "Enviar notificación de prueba" (spec 006 US8; contracts/screens.md → Prueba): sent → a
 * confirmation; 429 → disabled with "Espera <s> s" counting down; 409, 502 or no network → the
 * error text.
 */
export function TestNotificationButton() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  const send = async () => {
    setSending(true);
    setMessage(null);
    try {
      await sendTestNotification();
      setMessage({ text: 'Te enviamos una notificación de prueba', color: 'success' });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TEST_RATE_LIMITED') {
        setWaitSeconds(error.retryAfterSeconds ?? 30);
      } else {
        setMessage({ text: errorText(error), color: 'danger' });
      }
    } finally {
      setSending(false);
    }
  };

  const waiting = waitSeconds > 0;
  return (
    <View style={styles.container}>
      <Button
        label={waiting ? `Espera ${waitSeconds} s` : 'Enviar notificación de prueba'}
        variant="secondary"
        onPress={() => void send()}
        loading={sending}
        disabled={waiting}
      />
      {message !== null ? (
        <Text variant="secondary" color={message.color} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
});
