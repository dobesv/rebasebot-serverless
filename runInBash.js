const spawn = require('child_process').spawn;
const stream = require('stream');
const fs = require('fs');

lineStream = writeLine => {
  let lastLine = new Buffer(''),
    delim = new Buffer('\n');
  return new stream.Transform({
    transform(chunk, encoding, cb) {
      chunk = Buffer.concat([lastLine, chunk]);
      var delimIx = -1,
        offset = 0;
      while ((delimIx = chunk.indexOf(delim, offset)) >= 0) {
        writeLine(chunk.slice(offset, delimIx).toString('utf8'));
        offset = delimIx + delim.length;
      }
      lastLine = chunk.slice(offset);
      cb();
    },
    flush(cb) {
      if (lastLine.length) writeLine(lastLine.toString('utf8'));
      cb();
    },
  });
};

const runInBash = (cmd, opts) => new Promise((resolve, reject) => {
  const logCmd = opts.logCmd || cmd;
  delete opts.logCmd;
  const output = opts.output || [];
  delete opts.output;

  const proc = spawn('/bin/bash', ['-xc', cmd], opts);
  proc.stdout.pipe(lineStream(line => {
    console.log(line);
    output.push(line+'\n');
  }));
  proc.stderr.pipe(lineStream(line => {
    console.error(line);
    output.push(line+'\n');
  }));
  proc.on('error', err => {
    console.log(`Error running command "${cmd}" in "${opts.cwd}": ${err}`)
    err.output = output.join('');
    reject(err);
  });
  proc.on('close', function(code) {
    if (code) {
      const err = new Error(`Command "${logCmd}" failed with code ${code}`);
      err.code = code;
      err.output = output.join('');
      reject(err);
    } else {
      resolve(output.join(''));
    }
  });
});

module.exports = runInBash;
