import vm from 'node:vm';

export async function runSandboxedCode({ code, language = 'javascript', timeout = 3000 }) {
  if (language !== 'javascript') {
    return { ok: false, output: '', error: 'Only JavaScript is supported in the sandbox for now.' };
  }

  return new Promise((resolve) => {
    const context = {
      console: {
        log: (...args) => {
          output.push(args.map((arg) => String(arg)).join(' '));
        },
        error: (...args) => {
          errors.push(args.map((arg) => String(arg)).join(' '));
        }
      },
      setTimeout,
      clearTimeout,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error
    };

    const output = [];
    const errors = [];

    const script = new vm.Script(code);
    const timer = setTimeout(() => {
      resolve({ ok: false, output: output.join('\n'), error: `Execution timed out after ${timeout}ms.` });
    }, timeout);

    try {
      script.runInNewContext(context, { timeout: Math.max(50, timeout - 100) });
      clearTimeout(timer);
      resolve({ ok: true, output: output.join('\n') || 'No output', error: errors.join('\n') || null });
    } catch (error) {
      clearTimeout(timer);
      resolve({ ok: false, output: output.join('\n'), error: error.message });
    }
  });
}
