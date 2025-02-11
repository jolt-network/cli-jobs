import { Job, makeid, prelog, toKebabCase } from '@jolt-network/cli-utils';
import { Contract } from 'ethers';
import GENERIC_JOB_ABI from '../../abi/generic-job.json';
import metadata from './metadata.json';

const jobAddress = '0xC1204Dd8F54C57C27d67A84405EB61Af9f69B826';

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

  const job = new Contract(jobAddress, GENERIC_JOB_ABI, args.fork.ethersProvider).connect(args.workerAddress);

  try {
    await job.callStatic.work('0x', {
      nonce: args.workerNonce,
      gasLimit: 2_000_000,
      type: 2,
    });

    logConsole.log(`Found workable block`);

    const tx = await job.populateTransaction.work('0x', {
      nonce: args.workerNonce,
      gasLimit: 2_000_000,
      type: 2,
    });

    args.subject.next({
      workableGroups: [
        {
          targetBlock: args.targetBlock,
          txs: [tx],
          logId: `${logMetadata.logId}-${makeid(5)}`,
        },
      ],
      correlationId,
    });
  } catch (err: any) {
    logConsole.warn('Simulation failed, maybe in cooldown?', err);
  } finally {
    args.subject.complete();
  }
};

module.exports = {
  getWorkableTxs,
} as Job;
