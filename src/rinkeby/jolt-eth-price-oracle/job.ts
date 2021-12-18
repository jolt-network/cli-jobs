import { Job, JobWorkableGroup, makeid, prelog, toKebabCase } from '@jolt-network/cli-utils';
import { Contract } from 'ethers';
import GENERIC_JOB_ABI from '../../abi/generic-job.json';
import metadata from './metadata.json';

const jobAddress = '0x190568b7A4E97ccaFe089040afF65F06Db15Ea47';

const getWorkableTxs: Job['getWorkableTxs'] = async (args) => {
  const correlationId = toKebabCase(metadata.name);
  if (args.skipIds.includes(correlationId)) {
    console.log(`${metadata.name} in progress, avoid running`);
    return args.subject.complete();
  }

  const logMetadata = {
    job: metadata.name,
    block: args.advancedBlock,
    logId: makeid(5),
  };

  const logConsole = prelog(logMetadata);

  logConsole.log(`Trying to work`);

  const job = new Contract(jobAddress, GENERIC_JOB_ABI, args.fork.ethersProvider);

  try {
    await job.connect(args.workerAddress).callStatic.work({
      blockTag: args.advancedBlock,
    });

    logConsole.log(`Found workable block`);

    const workableGroups: JobWorkableGroup[] = [];

    for (let index = 0; index < args.bundleBurst; index++) {
      const tx = await job.connect(args.workerAddress).populateTransaction.work({
        nonce: args.workerNonce,
        gasLimit: 2_000_000,
        type: 2,
      });

      workableGroups.push({
        targetBlock: args.targetBlock + index,
        txs: [tx],
        logId: `${logMetadata.logId}-${makeid(5)}`,
      });
    }

    args.subject.next({
      workableGroups,
      correlationId,
    });
  } catch (err: any) {
    logConsole.warn('Simulation failed, maybe in cooldown?');
  } finally {
    args.subject.complete();
  }
};

module.exports = {
  getWorkableTxs,
} as Job;
