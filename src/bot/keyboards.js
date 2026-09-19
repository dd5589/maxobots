import { Keyboard } from '@maxhub/max-bot-api';

export function miniAppKeyboard(url, payload) {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.openApp(
        'Открыть чек-лист',
        url,
        undefined,
        payload,
      ),
    ],
  ]);
}
