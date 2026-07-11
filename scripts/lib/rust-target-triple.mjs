export function rustArch() {
  if (process.arch === "x64") {
    return "x86_64";
  }
  if (process.arch === "arm64") {
    return "aarch64";
  }
  return process.arch;
}

export function rustTargetTriple() {
  const arch = rustArch();
  if (process.platform === "win32") {
    return `${arch}-pc-windows-msvc`;
  }
  if (process.platform === "darwin") {
    return `${arch}-apple-darwin`;
  }
  return `${arch}-unknown-linux-gnu`;
}
