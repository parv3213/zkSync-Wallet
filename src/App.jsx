import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { ethers } from "ethers";
import * as zksync from "zksync";

export default function App() {
	const [web3, setWeb3] = useState(undefined);
	const [account, setAccount] = useState("");
	const [syncWallet, setSyncWallet] = useState(undefined);
	const [syncHTTPProvider, setSyncHTTPProvider] = useState(undefined);
	const [committedEthBalance, setCommittedEthBalance] = useState(undefined);
	const [verifiedEthBalance, setVerifiedEthBalance] = useState(undefined);

	const getWeb3 = () => {
		return new Promise(async (resolve, reject) => {
			if (window.ethereum) {
				const web3 = new Web3(window.ethereum);
				try {
					await window.ethereum.enable();
					resolve(web3);
				} catch (e) {
					reject(e);
				}
			} else if (window.web3) {
				resolve(window.web3);
			} else {
				window.alert("Must install Metamask Extension!\nDApp will not load");
				reject("Must install Metamask Extension!");
			}
		});
	};

	const zkSyncInitialize = async (web3) => {
		await web3.currentProvider.enable();
		const ethersProvider = new ethers.providers.Web3Provider(web3.currentProvider);
		const syncHTTPProvider = await zksync.Provider.newHttpProvider("https://rinkeby-api.zksync.io/jsrpc");
		const singer = ethersProvider.getSigner();
		const syncWallet = await zksync.Wallet.fromEthSigner(singer, syncHTTPProvider);
		console.log(syncWallet);
		return ({syncWallet, syncHTTPProvider})
	};

	const signKey = async (syncWallet) => {
		console.log(`User account status: ${await syncWallet.isSigningKeySet()}`);
		if (!(await syncWallet.isSigningKeySet())) {
			console.log("Setting singing key");
			const changePubkey = await syncWallet.setSigningKey({
				feeToken: "ETH",
			});
			// Wait till transaction is committed
			const receipt = await changePubkey.awaitReceipt();
		}
	};

	useEffect(() => {
		const init = async () => {
			const web3 = await getWeb3();
			const account = (await web3.eth.getAccounts())[0];
			const {syncWallet, syncHTTPProvider} = await zkSyncInitialize(web3)
			setWeb3(web3);
			setAccount(account);
			setSyncWallet(syncWallet);
			setSyncHTTPProvider(syncHTTPProvider);
			signKey(syncWallet);
		};
		init();
	}, []);

	const deposit = async () => {
		// Depositing assets from Ethereum into zkSync
		const deposit = await syncWallet.depositToSyncFromEthereum({
			depositTo: syncWallet.address(),
			token: "ETH",
			amount: ethers.utils.parseEther("0.1"),
		});

		// Await confirmation from the zkSync operator
		// Completes when a promise is issued to process the tx
		let depositReceipt = await deposit.awaitReceipt();
		console.log(depositReceipt);

		// Await verification
		// Completes when the tx reaches finality on Ethereum
		depositReceipt = await deposit.awaitVerifyReceipt();
		console.log(depositReceipt);
	};

	const checkStatus = async () => {
		const state = await syncWallet.getAccountState();
		console.log(state);
		setCommittedEthBalance(state.committed.balances.ETH);
		setVerifiedEthBalance(state.verified.balances.ETH);
	};

	const withdraw = async () => {
		// withdraw money back to Ethereum
		const withdraw = await syncWallet.withdrawFromSyncToEthereum({
			ethAddress: syncWallet.address(),
			token: "ETH",
			amount: ethers.utils.parseEther("0.1"),
		});
		const withdrawReceipt = await withdraw.awaitReceipt();
		console.log(withdrawReceipt);
		await withdraw.awaitVerifyReceipt();
	};

	const transfer = async () => {
		const amount = zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther("0.1"));
		// const fee = zksync.utils.closestPackableTransactionFee(ethers.utils.parseEther("0.001"));
		// transfer eth to another account
		const transfer = await syncWallet.syncTransfer({
			to: "0x6C12a705de85a44EAE07fCfb2932Db9Fd1ca1df6",
			token: "ETH",
			amount,
		});
		// track the transfer status
		const transferReceipt = await transfer.awaitReceipt();
		console.log(transferReceipt);
	};

	const allTokens = async () => {
		console.log(await syncHTTPProvider.getTokens());
	};

	const unlockTokens = async () => {
		console.log(await syncWallet.isERC20DepositsApproved("0xeb8f08a975ab53e34d8a0330e0d34de942c95926"));
		const unlock = await syncWallet.approveERC20TokenDeposits("0xeb8f08a975ab53e34d8a0330e0d34de942c95926");
		console.log(unlock);
	};

	const depositUSDC = async () => {
		const depositPriorityOperation = await syncWallet.depositToSyncFromEthereum({
			depositTo: account,
			token: "0xeb8f08a975ab53e34d8a0330e0d34de942c95926",
			amount: String(10e6),
		});
		// Wait till priority operation is committed.
		const priorityOpReceipt = await depositPriorityOperation.awaitReceipt();
		console.log(priorityOpReceipt);
	};

	const transferUSDC = async () => {
		const amount = zksync.utils.closestPackableTransactionAmount(10e6);
		// const fee = zksync.utils.closestPackableTransactionFee(ethers.utils.parseEther("0.001"));
		// transfer eth to another account
		const transfer = await syncWallet.syncTransfer({
			to: "0x6C12a705de85a44EAE07fCfb2932Db9Fd1ca1df6",
			token: "0xeb8f08a975ab53e34d8a0330e0d34de942c95926",
			amount,
		});
		// track the transfer status
		const transferReceipt = await transfer.awaitReceipt();
		console.log(transferReceipt);
	};

	return (
		<div>
			{syncWallet === undefined ? (
				<button onClick={zkSyncInitialize}>Initialize</button>
			) : (
				<div>
					<p>Sync wallet connected</p>
					<br />
					<button onClick={checkStatus}>Check Account State</button>
					<button onClick={deposit}>Deposit 0.1 ETH</button>
					<button onClick={withdraw}>Withdraw 0.1 ETH</button>
					<button onClick={transfer}>transfer 0.1 ETH</button>
					<button onClick={allTokens}>Check all tokens</button>
					<button onClick={unlockTokens}>Unlock USDC</button>
					<button onClick={depositUSDC}>Deposit 10 USDC</button>
					<button onClick={transferUSDC}>Transfer 10 USDC</button>
					<br />
					<p>Committed Balance: {committedEthBalance === undefined ? "" : committedEthBalance / 1e18}</p>
					<p>Verified Balance: {verifiedEthBalance === undefined ? "" : verifiedEthBalance / 1e18}</p>
					<p>{account}</p>
				</div>
			)}
		</div>
	);
}
