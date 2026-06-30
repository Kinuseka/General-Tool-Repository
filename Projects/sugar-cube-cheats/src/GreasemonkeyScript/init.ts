import {InternationalCheatLauncher} from "./start";

declare const unsafeWindow: Window | undefined;

const runtimeWindow = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window) as Window;

(() => {
    const launcher = new InternationalCheatLauncher(runtimeWindow as any);
    launcher.bootstrap();
})();

