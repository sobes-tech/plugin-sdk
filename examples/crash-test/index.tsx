/** @jsxImportSource react */
import { renderPlugin, usePlugin } from "../../src/react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Page,
  PageHeader,
  Stack,
  Text,
} from "../../src/components";

function CrashTest() {
  const { locale } = usePlugin();
  const ru = locale === "ru";

  return (
    <Page>
      <PageHeader
        title={ru ? "Проверка сбоев" : "Crash Test"}
        description={
          ru
            ? "Каждая проверка запускается только по вашему действию. Открытие страницы не вызывает ошибок."
            : "Each test starts only when you trigger it. Opening this page does not cause an error."
        }
      />
      <Stack>
        <Card>
          <CardHeader>
            <Heading level={2}>{ru ? "Ошибки React-интерфейса" : "React view errors"}</Heading>
          </CardHeader>
          <CardContent>
            <Stack>
              <Text>
                {ru
                  ? "Кнопки намеренно вызывают ошибку внутри iframe плагина. Ожидается сообщение об ошибке плагина; главное приложение и другие плагины должны продолжить работу."
                  : "These buttons deliberately cause an error inside the plugin iframe. Expect a plugin error report; the main application and other plugins should remain usable."}
              </Text>
              <Button
                variant="outline"
                onClick={() => {
                  throw new Error("Crash Test: deliberate synchronous UI error");
                }}
              >
                {ru ? "Вызвать синхронную ошибку" : "Throw a synchronous error"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Deliberately unhandled: the host's rejection reporting is under test.
                  void Promise.reject(new Error("Crash Test: deliberate unhandled UI rejection"));
                }}
              >
                {ru ? "Отклонить Promise без обработчика" : "Create an unhandled rejection"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Heading level={2}>{ru ? "Ошибки worker" : "Worker errors"}</Heading>
          </CardHeader>
          <CardContent>
            <Stack gap={8}>
              <Text>
                {ru
                  ? "В настройках установленного плагина запустите «Проверить ошибку worker» для исключения или «Проверить таймаут worker» для бесконечного цикла в отдельном процессе."
                  : "In this installed plugin's settings, run Test worker exception to throw an error, or Test worker timeout to enter an infinite loop in a separate process."}
              </Text>
              <Text muted>
                {ru
                  ? "Ожидается ошибка или таймаут только выбранного вызова. Цикл не выделяет память и не вызывает API; его должен остановить обычный лимит непрерывного выполнения worker."
                  : "Only the selected invocation should fail or time out. The loop does not allocate memory or call APIs; the normal uninterrupted-worker execution limit should stop it."}
              </Text>
              <Text small muted>
                {ru
                  ? "Плагин не читает данные аккаунта, не пишет файлы и не обращается к сети или нативным API. Проверка не доказывает изоляцию, пока её не выполнили в целевом приложении."
                  : "This plugin does not read account data, write files or use network or native APIs. Isolation is not verified until these tests run in the intended host."}
              </Text>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Page>
  );
}

renderPlugin({ main: CrashTest });
