// src/polyfills.ts

import * as process from 'process';
import * as stream from 'stream-browserify';
import * as buffer from 'buffer';
import 'zone.js';  // Required for Angular's Zone.js support.


(window as any).process = process;
(window as any).stream = stream;
(window as any).Buffer = buffer.Buffer;
