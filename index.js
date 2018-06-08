const EventEmitter = require('events');
const authenticator = require('authenticator');
const Request = require('./libs/helpers/request');
const Item = require('./libs/classes/Item');
const Trade = require('./libs/classes/Trade');
const User = require('./libs/classes/User');

const sleep = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

class OPSkinsTrade extends EventEmitter {
  constructor(apiKey, secret, polling = 1000) {
    super();
    this.request = new Request(apiKey);
    this.Item = new Item(this.request);
    this.Trade = new Trade(this.request);
    this.User = new User(this.request);
    this.api_key = apiKey;
    this.secret = secret;
    this.polling = polling;
    this.pollData = {};
  }

  generateTwoFactor() {
    return authenticator.generateToken(this.secret);
  }

  async pollTrades() {
    const fetchTrades = await this.Trade.getOffers();
    const { offers } = fetchTrades.response;

    offers.forEach((offer) => {
      if (Object.keys(this.pollData).includes(offer.id)) {
        if (this.pollData[offer.id].state !== offer.state) {
          this.emit('offerUpdated', offer);
        }
        return;
      }
      this.pollData[offer.id] = offer;
      this.emit('newOffer', offer);
    });

    await sleep(this.polling);
    this.pollTrades();
  }

  getUserInventory(steamid) {
    return this.Trade.getUserInventoryFromSteamId({ steam_id: steamid, app_id: '2' });
  }

  async sendOffer(steamid, items) {
    const sendOffer = await this.Trade.sendOfferToSteamId({
      twofactor_code: this.generateTwoFactor(),
      steam_id: steamid,
      items,
    });
    const { offer } = sendOffer.response;
    this.emit('sentOffer', offer);
  }

  async acceptOffer(offerId) {
    const acceptOffer = await this.Trade.acceptOffer({
      twofactor_code: this.generateTwoFactor(),
      offer_id: offerId,
    });
    const { offer } = acceptOffer.response;
    this.pollData[offer.id] = offer;
    this.emit('offerUpdated', offer);
  }
}

module.exports = OPSkinsTrade;
