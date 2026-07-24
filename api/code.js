const { execSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { language, code } = req.body;
  if (!language || !code) return res.status(400).json({ error: 'Missing language or code' });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-'));
  const timeout = 15000;

  try {
    let result;
    switch (language) {
      case 'python':
        result = await runCmd('python3', ['-c', code], tmpDir, timeout);
        break;
      case 'c':
        result = await compileAndRun(code, 'main.c', 'gcc', ['-o', 'main', 'main.c'], './main', tmpDir, timeout);
        break;
      case 'cpp':
        result = await compileAndRun(code, 'main.cpp', 'g++', ['-o', 'main', 'main.cpp', '-lstdc++'], './main', tmpDir, timeout);
        break;
      case 'java':
        result = await compileAndRun(code, 'Main.java', 'javac', ['Main.java'], 'java Main', tmpDir, timeout);
        break;
      default:
        return res.status(400).json({ error: `Unsupported language: ${language}` });
    }
    return res.status(200).json({
      run: {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        code: result.exitCode || 0,
      }
    });
  } catch (err) {
    return res.status(200).json({
      run: {
        stdout: '',
        stderr: err.message || 'Execution failed',
        code: 1,
      }
    });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
};

function runCmd(cmd, args, cwd, timeout) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, { cwd, timeout, env: { ...process.env, PATH: process.env.PATH } });
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => resolve({ stdout, stderr, exitCode: code }));
    proc.on('error', err => resolve({ stdout: '', stderr: err.message, exitCode: 1 }));
  });
}

async function compileAndRun(code, fileName, compiler, compileArgs, runCmd, tmpDir, timeout) {
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, code);

  const compile = await runCmd2(compiler, compileArgs, tmpDir, timeout);
  if (compile.exitCode !== 0) {
    return { stdout: '', stderr: compile.stderr || compile.stdout || 'Compilation failed', exitCode: 1 };
  }

  const parts = runCmd.split(' ');
  return await runCmd2(parts[0], parts.slice(1), tmpDir, timeout);
}

function runCmd2(cmd, args, cwd, timeout) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '';
    const proc = spawn(cmd, args, { cwd, timeout, env: { ...process.env, PATH: process.env.PATH } });
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => resolve({ stdout, stderr, exitCode: code }));
    proc.on('error', err => resolve({ stdout: '', stderr: err.message, exitCode: 1 }));
  });
}
