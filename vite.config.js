import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'rollup-plugin-obfuscator'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    obfuscator({
      options: {
        // --- 混淆強度設定 ---
        compact: true, // 壓縮代碼到一行
        controlFlowFlattening: true, // 打亂程式邏輯流程，讓人看不懂
        controlFlowFlatteningThreshold: 1,
        deadCodeInjection: true, // 注入一堆沒用的廢代碼混淆視聽
        deadCodeInjectionThreshold: 1,
        debugProtection: true, // 防調試：打開 DevTools 會卡住或不斷 debugger
        debugProtectionInterval: 4000,
        disableConsoleOutput: true, // 禁止 console.log 輸出
        identifierNamesGenerator: 'hexadecimal', // 變數名稱變成 16 進位亂碼 (如 _0x5a3f)
        log: false,
        numbersToExpressions: true, // 把數字變成算式 (如 123 變成 50+73)
        renameGlobals: false,
        rotateStringArray: true,
        selfDefending: true, // 自我防衛機制，防止代碼被格式化
        shuffleStringArray: true,
        simplify: true,
        splitStrings: true, // 把字串切碎
        stringArray: true,
        stringArrayEncoding: ['base64', 'rc4'], // 字串加密
        stringArrayThreshold: 1,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
      },
      // 確保只混淆我們寫的代碼，不混淆 node_modules (不然會跑不動)
      include: ['src/**/*.js', 'src/**/*.jsx'], 
    })
  ],
  build: {
    // 關閉 source map，這樣別人就不能還原代碼
    sourcemap: false, 
  }
})