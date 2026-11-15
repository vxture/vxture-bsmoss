import {main} from './demo-entry.mjs';
main().catch(error=>{console.error('demo operation failed:',error.code??'validation_failed');process.exitCode=1;});
