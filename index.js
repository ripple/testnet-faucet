const express = require('express')
const cors = require('cors')
const { Client, Wallet, isValidClassicAddress, classicAddressToXAddress } = require('xrpl')

const app = express()
const port = 3000

const rippledUri = process.env['RIPPLED_URI']
const address = process.env['FUNDING_ADDRESS']
const secret = process.env['FUNDING_SECRET']
const amount = process.env['XRP_AMOUNT']

app.use(cors())
app.use(express.json())

app.post('/accounts', async (req, res) => {
  const destination = req.body && req.body.destination

  if (destination !== undefined && destination !== null && !isValidClassicAddress(destination)) {
    res.status(400).send({ error: `Invalid destination address: ${destination}` })
    return
  }

  const client = new Client(rippledUri)
  try {
    await client.connect()
    console.log('Connected...')

    // xrpl.js's fundWallet() generates the wallet itself and sends its address
    // as `destination`; it expects that exact address to be the one funded.
    // With no destination (plain POST), generate a new wallet and return its secret.
    const wallet = destination ? null : Wallet.generate()
    const classicAddress = destination || wallet.classicAddress
    console.log(wallet ? 'Generated new account:' : 'Funding requested account:', classicAddress)

    const fundingWallet = Wallet.fromSeed(secret)

    const tx = await client.autofill({
      TransactionType: 'Payment',
      Account: address,
      Destination: classicAddress,
      Amount: String(Number(amount) * 1_000_000),
    })

    const { tx_blob } = fundingWallet.sign(tx)
    const submitted = await client.submit(tx_blob)
    const engineResult = submitted.result.engine_result
    if (engineResult !== 'tesSUCCESS' && engineResult !== 'terQUEUED') {
      throw new Error(`Funding payment rejected: ${engineResult} ${submitted.result.engine_result_message}`)
    }

    console.log(`Funded ${classicAddress} with ${amount} XRP`)
    const account = {
      classicAddress,
      xAddress: classicAddressToXAddress(classicAddress, false, false),
      address: classicAddress,
    }
    if (wallet) {
      account.secret = wallet.seed
    }
    res.send({
      account,
      amount: Number(amount),
      balance: Number(amount),
    })
  } catch (err) {
    console.error(err)
    res.status(500).send({ error: err.message })
  } finally {
    await client.disconnect()
  }
})

app.listen(port, () => console.log(`Altnet faucet listening on port ${port}!`))
