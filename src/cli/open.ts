import { spawn } from "node:child_process";

export async function openBrowser(url: string): Promise<void> {
  try {
    const platform = process.platform;
    if (platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    } else if (platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // melhor esforço: o usuário pode abrir a URL manualmente
  }
}
