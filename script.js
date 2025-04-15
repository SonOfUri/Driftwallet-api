const { Alchemy, Network } = require("alchemy-sdk");
// const { ethers } = require("ethers"); // Import ethers.js
require("dotenv").config();
const axios = require("axios"); // For making HTTP requests to DexScreener

// Initialize Alchemy SDK
const config = {
  apiKey: process.env.ALCHEMY_API_KEY, // Your Alchemy API Key
  network: Network.BASE_MAINNET, // Ethereum Mainnet
};
const alchemy = new Alchemy(config);

// DexScreener API Base URL
const dexscreenerBaseURL = "https://api.dexscreener.com/tokens/v1/base/";

// Function to format token balance using ethers.js
const formatBalance = (balance, decimals) => {
  // Ensure the balance is a valid value
  if (!balance || balance === "0" || balance === "0x0" || balance === "0x") {
    console.log("Warning: Invalid or zero balance provided.");
    return 0; // Return 0 if balance is invalid or empty
  }

  try {
    // Convert to BigInt and divide by decimals
    const formattedBalance = Number(BigInt(balance)) / 10 ** decimals;
    return formattedBalance;
  } catch (error) {
    console.error("Error formatting balance:", error);
    return 0; // Return 0 in case of error
  }
};

// Function to fetch token price from DexScreener API
const getTokenPrice = async (contractAddress) => {
  try {
    const response = await axios.get(`${dexscreenerBaseURL}${contractAddress}`);
    if (response.data && response.data.length > 0) {
      const tokenData = response.data[0];
      return parseFloat(tokenData.priceUsd); // Return the price in USD as a float
    }
    return null;
  } catch (error) {
    console.error(`Error fetching price for token: ${contractAddress}`, error);
    return null;
  }
};

const getTokenImage = async (contractAddress) => {
  try {
    const response = await axios.get(`${dexscreenerBaseURL}${contractAddress}`);
    if (response.data && response.data.length > 0) {
      const tokenData = response.data[0];
      // Check if imageUrl exists, return it, otherwise return null
      return tokenData.info && tokenData.info.imageUrl
        ? tokenData.info.imageUrl
        : null;
    }
    return null; // Return null if no data found
  } catch (error) {
    console.error(`Error fetching image for token: ${contractAddress}`, error);
    return null;
  }
};

// Function to get token balances and format them, excluding zero balances
const getFormattedTokenBalances = async (address) => {
  console.log(`Fetching token balances for wallet address: ${address}`);

  try {
    // Fetch token balances for the provided address
    const balances = await alchemy.core.getTokenBalances(address);
    console.log(
      `Fetched ${balances.tokenBalances.length} token balances for ${address}`
    );

    let totalWalletBalance = 0; // To store the total wallet value in USD
    const tokens = []; // To store the list of token data with price info

    // Fetch Ethereum (ETH) balance using WETH contract address for price and image
    const ethBalanceHex = await alchemy.core.getBalance(address); // Hexadecimal balance in Wei
    console.log("ETH Balance Hex:", ethBalanceHex); // Log the raw balance in hex
    const ethBalanceInWei = BigInt(ethBalanceHex); // Convert Hex to BigInt (Wei)
    const formattedEthBalance = Number(ethBalanceInWei) / 10 ** 18; // Convert Wei to Ether
    const ethPrice = await getTokenPrice(
      "0x4200000000000000000000000000000000000006"
    ); // Get ETH price using WETH contract address
    const ethTotalBalanceInUSD = formattedEthBalance * ethPrice;

    // Set a unique image URL for ETH
    const ethImage =
      "https://dd.dexscreener.com/ds-data/tokens/base/0x4200000000000000000000000000000000000006.png?key=7d6327";

    // Add ETH details to tokens array
    tokens.push({
      name: "ETHEREUM",
      symbol: "ETH",
      quantity: formattedEthBalance,
      price: ethPrice,
      image: ethImage, // Unique image URL for ETH
      totalBalance: ethTotalBalanceInUSD,
      contractAddress: "0x4200000000000000000000000000000000000006", // Using WETH address for ETH price
    });

    // Add ETH balance to the total wallet balance
    totalWalletBalance += ethTotalBalanceInUSD;

    // Loop through all token balances and format them
    for (let token of balances.tokenBalances) {
      const contractAddress = token.contractAddress;
      let balance = token.tokenBalance;

      // Debugging: log the balance for each token
      console.log(`Raw Balance for ${contractAddress}:`, balance);

      // Ensure that balance is a valid value (BigInt or string)
      if (
        !balance ||
        balance === "0" ||
        balance === "0x0" ||
        balance === "0x"
      ) {
        console.log(`Skipping token with invalid balance: ${contractAddress}`);
        continue;
      }

      try {
        // If it's a string, convert it to BigInt
        if (typeof balance === "string" || balance instanceof String) {
          balance = BigInt(balance);
        } else if (typeof balance !== "bigint") {
          console.error(`Invalid balance for token: ${contractAddress}`);
          continue;
        }

        // Fetch metadata (decimals) for each token
        const metadata = await alchemy.core.getTokenMetadata(contractAddress);

        if (metadata && metadata.decimals) {
          // Format the balance using ethers.js
          const formattedBalance = formatBalance(balance, metadata.decimals);

          // Get the token price from DexScreener
          const price = await getTokenPrice(contractAddress);
          if (!price) continue; // If no price found, skip this token

          const image = await getTokenImage(contractAddress);

          // Calculate total balance for this token (balance * price)
          const totalBalanceInUSD = formattedBalance * price;

          // Add the total balance of this token to the overall wallet balance
          totalWalletBalance += totalBalanceInUSD;

          // Store the token information
          tokens.push({
            name: metadata.name,
            symbol: metadata.symbol,
            quantity: formattedBalance,
            price: price,
            image: image !== undefined ? image : null, // Explicitly set image to null if undefined
            totalBalance: totalBalanceInUSD,
            contractAddress: contractAddress,
          });

          // Log token details (for debugging)
          console.log(`Token: ${metadata.name} (${metadata.symbol})`);
          console.log(`Contract Address: ${contractAddress}`);
          console.log(`Balance: ${formattedBalance}`);
          console.log(`Price (USD): ${price}`);
          console.log(`Total Balance in USD: ${totalBalanceInUSD}`);
          console.log("----------------------------------");
        } else {
          console.log(`No metadata found for token: ${contractAddress}`);
        }
      } catch (error) {
        console.error(`Error processing token ${contractAddress}:`, error);
      }
    }

    // Log the total wallet balance
    console.log(`Total Wallet Balance (USD): ${totalWalletBalance}`);

    // Return the final result
    return {
      totalWalletBalance,
      tokens,
    };
  } catch (error) {
    console.error("Error fetching token balances:", error);
  }
};

// Test with a wallet address (change this to a real wallet address for testing)
const testWalletAddress = "0x6f0487c61e6cf1b6b00759888e37d8df38aca4f0";

// Call the function and get formatted balances with prices
getFormattedTokenBalances(testWalletAddress).then((result) => {
  console.log(JSON.stringify(result, null, 2)); // Pretty-print the final result
});
