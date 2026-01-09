import { spawn } from 'child_process';

spawn('node', ['minero2_prueba.js'], { stdio: 'inherit' });
spawn('node', ['extractor_detalle_2.js'], { stdio: 'inherit' });