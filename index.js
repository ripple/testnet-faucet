const express = require('express')
const cors = require('cors')
const { Client, Wallet } = require('xrpl')

const app = express()
const port = 3000

const rippledUri = process.env['RIPPLED_URI']
const address = process.env['FUNDING_ADDRESS']
const secret = process.env['FUNDING_SECRET']
const amount = process.env['XRP_AMOUNT']

app.use(cors())

app.post('/accounts', async (req, res) => {
  const client = new Client(rippledUri)
  try {
    await client.connect()
    console.log('Connected...')

    const wallet = Wallet.generate()
    console.log('Generated new account:', wallet.address)

    const fundingWallet = Wallet.fromSeed(secret)

    const tx = await client.autofill({
      TransactionType: 'Payment',
      Account: address,
      Destination: wallet.address,
      Amount: String(Number(amount) * 1_000_000),
    })

    const { tx_blob } = fundingWallet.sign(tx)
    await client.submit(tx_blob)

    console.log(`Funded ${wallet.address} with ${amount} XRP`)
    res.send({
      account: {
        address: wallet.address,
        secret: wallet.seed,
      },
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
