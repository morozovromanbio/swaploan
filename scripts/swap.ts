import { ethers } from "ethers";
import "dotenv/config";
// eslint-disable-next-line node/no-missing-import
import { Token } from "../typechain/Token";
// eslint-disable-next-line node/no-missing-import
import { ISwapRouter } from "../typechain/ISwapRouter";
import * as tokenJson from "../artifacts/contracts/ERC20.sol/Token.json";
import * as uniswapRouterJson from "../artifacts/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json";

const UNISWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const WETH_ADDRESS = "0xc778417e063141139fce010982780140aa0cd5ab";
const DAI_ADDRESS = "0xaD6D458402F60fD3Bd25163575031ACDce07538D";
const BAT_ADDRESS = "0x85B24b3517E3aC7bf72a14516160541A60cFF19d";
const USDT_ADDRESS = "0xB404c51BBC10dcBE948077F18a4B8E553D160084";
const LINK_ADDRESS = "0x1a906E71FF9e28d8E01460639EB8CF0a6f0e2486";
const poolFee = 3000;

// This key is already public on Herong's Tutorial Examples - v1.03, by Dr. Herong Yang
// Do never expose your keys like this
const EXPOSED_KEY =
  "8da4ef21b864d2cc526dbdb2a120bd2874c36c9d0a1fb7f8c63d7f7a8b41de8f";

let daiContract: Token;
let batContract: Token;
let wethContract: Token;
let usdtContract: Token;
let linkContract: Token;
let uniswapRouter: ISwapRouter;

async function main() {
  const wallet = setupWallet();
  console.log(`Using address ${wallet.address}`);
  const provider = setupProvider();
  console.log(`Connected to the node at ${provider.connection.url}`);
  await checkNetwork(provider);
  const signer = await setupSigner(wallet, provider);
  initContracts(signer);
  const [daiDecimals, batDecimals, wethDecimals, usdtDecimals, linkDecimals] =
    await Promise.all([
      daiContract.decimals(),
      batContract.decimals(),
      wethContract.decimals(),
      usdtContract.decimals(),
      linkContract.decimals(),
    ]);
  await checkTokenBalances(
    signer,
    daiDecimals,
    batDecimals,
    wethDecimals,
    usdtDecimals,
    linkDecimals
  );
  await swapDaiForWeth(signer, daiDecimals, provider);
  await checkTokenBalances(
    signer,
    daiDecimals,
    batDecimals,
    wethDecimals,
    usdtDecimals,
    linkDecimals
  );
}

function setupWallet() {
  return process.env.MNEMONIC && process.env.MNEMONIC.length > 0
    ? ethers.Wallet.fromMnemonic(process.env.MNEMONIC)
    : new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
}

function setupProvider() {
  const rpcUrl = process.env.CUSTOM_RPC_URL;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  return provider;
}

async function checkNetwork(provider: any) {
  const network = await provider.getNetwork();
  console.log(`Network name: ${network.name}\nChain Id: ${network.chainId}`);
  const lastBlock = await provider.getBlock("latest");
  console.log(`Connected at height: ${lastBlock.number}`);
}

async function setupSigner(
  wallet: ethers.Wallet,
  provider: ethers.providers.JsonRpcProvider
) {
  const signer = wallet.connect(provider);
  const balanceBN = await signer.getBalance();
  const balance = Number(ethers.utils.formatEther(balanceBN));
  console.log(`Wallet balance ${balance} ETH`);
  if (balance < 0.01) {
    throw new Error("Not enough ETH to pay for gas fees");
  }
  return signer;
}

function initContracts(signer: ethers.Wallet) {
  daiContract = new ethers.Contract(
    DAI_ADDRESS,
    tokenJson.abi,
    signer
  ) as Token;
  batContract = new ethers.Contract(
    BAT_ADDRESS,
    tokenJson.abi,
    signer
  ) as Token;
  wethContract = new ethers.Contract(
    WETH_ADDRESS,
    tokenJson.abi,
    signer
  ) as Token;
  usdtContract = new ethers.Contract(
    USDT_ADDRESS,
    tokenJson.abi,
    signer
  ) as Token;
  linkContract = new ethers.Contract(
    LINK_ADDRESS,
    tokenJson.abi,
    signer
  ) as Token;
  uniswapRouter = new ethers.Contract(
    UNISWAP_ROUTER_ADDRESS,
    uniswapRouterJson.abi,
    signer
  ) as ISwapRouter;
}

async function checkTokenBalances(
  signer: ethers.Wallet,
  daiDecimals: number,
  batDecimals: number,
  wethDecimals: number,
  usdtDecimals: number,
  linkDecimals: number
) {
  const [
    daiBalanceBN,
    batBalanceBN,
    wethBalanceBN,
    usdtBalanceBN,
    linkBalanceBN,
  ] = await Promise.all([
    daiContract.balanceOf(signer.address),
    batContract.balanceOf(signer.address),
    wethContract.balanceOf(signer.address),
    usdtContract.balanceOf(signer.address),
    linkContract.balanceOf(signer.address),
  ]);
  const [daiBalance, batBalance, wethBalance, usdtBalance, linkBalance] = [
    ethers.utils.formatUnits(daiBalanceBN, daiDecimals),
    ethers.utils.formatUnits(batBalanceBN, batDecimals),
    ethers.utils.formatUnits(wethBalanceBN, wethDecimals),
    ethers.utils.formatUnits(usdtBalanceBN, usdtDecimals),
    ethers.utils.formatUnits(linkBalanceBN, linkDecimals),
  ];
  console.log({
    daiBalance,
    batBalance,
    wethBalance,
    usdtBalance,
    linkBalance,
  });
}

async function swapDaiForWeth(
  signer: ethers.Wallet,
  daiDecimals: number,
  provider: ethers.providers.JsonRpcProvider
) {
  const approval = await daiContract.allowance(
    signer.address,
    UNISWAP_ROUTER_ADDRESS
  );
  if (approval.lt(ethers.utils.parseUnits("0.01", daiDecimals))) {
    console.log("Approving DAI for the router");
    const daiApproveTx = await daiContract.approve(
      UNISWAP_ROUTER_ADDRESS,
      ethers.constants.MaxUint256
    );
    console.log("Awaiting confirmations");
    await daiApproveTx.wait();
    console.log("Completed!");
  }
  const lastBlock = await provider.getBlock("latest");
  console.log("Swapping 0.01 DAI for WETH");
  const swapTx = await uniswapRouter.exactInputSingle({
    tokenIn: DAI_ADDRESS,
    tokenOut: WETH_ADDRESS,
    fee: poolFee,
    recipient: signer.address,
    deadline: lastBlock.timestamp + 1000,
    amountIn: ethers.utils.parseUnits("0.01", daiDecimals),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  });
  console.log("Awaiting confirmations");
  await swapTx.wait();
  console.log("Completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
