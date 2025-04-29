# Blockchain Voting System

A decentralized voting system built with Ethereum smart contracts, MongoDB, and modern web technologies.

## Features

- Secure blockchain-based voting
- Voter registration and verification
- Real-time vote counting
- Admin dashboard for managing elections
- Modern and responsive UI
- MongoDB integration for voter data

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Ganache (for local blockchain)
- MetaMask browser extension
- Truffle Framework

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start MongoDB:
```bash
mongod
```

3. Start Ganache:
```bash
npx ganache --server.port 8545 --server.host "127.0.0.1" --chain.networkId 1337
```

4. Compile and deploy smart contracts:
```bash
npm run compile
npm run migrate:reset
```

5. Start the application:
```bash
npm start
```

6. Configure MetaMask:
   - Network Name: Ganache
   - New RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency Symbol: ETH

7. Import a Ganache account to MetaMask:
   - Copy the private key of the first account from Ganache
   - Import Account in MetaMask using the private key

## Usage

1. Connect your MetaMask wallet
2. Register as a voter with your details
3. Wait for admin verification
4. Once verified, you can participate in the voting
5. Admin can:
   - Add candidates
   - Start/stop voting
   - Verify voters

## Project Structure

- `/contracts`: Smart contracts
- `/migrations`: Truffle migration files
- `/server`: Express.js backend
- `/src`: Frontend files
- `/test`: Contract tests

## Technology Stack

- Ethereum (Solidity)
- Web3.js
- Node.js
- Express.js
- MongoDB/Mongoose
- Bootstrap 5
- Truffle Framework

## Security Features

- Blockchain-based vote storage
- One vote per verified address
- Admin-only access control
- Secure voter verification
- MetaMask integration for secure transactions

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
