const { sdk } = require('@farcaster/miniapp-sdk');

module.exports = function (eruda) {
  const { evalCss } = eruda.util

  class FarcasterMiniappPlugin extends eruda.Tool {
    constructor() {
      super()
      this.name = 'Mini App'
      this._style = evalCss(require('./style.scss'))
      this._isSDKReady = false
      this._sdkData = {}
    }

    async init($el, container) {
      super.init($el, container)
      await this._initializeFarcasterSDK()
      this._render()
      this._setupRefresh()
    }

    async _initializeFarcasterSDK() {
      try {
        await sdk.actions.ready()
        this._isSDKReady = true
        await this._gatherSDKData()
      } catch (error) {
        this._isSDKReady = false
      }
    }

    async _gatherSDKData() {
      const data = {}
      
      try {
        if (sdk.context) {
          data.context = sdk.context
        }
        
        if (sdk.context?.user) {
          data.user = sdk.context.user
        }
        
        if (sdk.context?.cast) {
          data.cast = sdk.context.cast
        }
        
        if (sdk.context?.client) {
          data.client = sdk.context.client
        }

        const allSDKProps = Object.keys(sdk).filter(key => 
          !['actions', 'wallet'].includes(key) && 
          typeof sdk[key] !== 'function'
        )
        
        data.sdkProperties = {}
        allSDKProps.forEach(prop => {
          try {
            data.sdkProperties[prop] = sdk[prop]
          } catch (e) {
            data.sdkProperties[prop] = `[Error accessing ${prop}]`
          }
        })

        // Enhanced wallet provider detection
        data.wallet = await this._detectWalletProviders()

        data.environment = {
          userAgent: navigator.userAgent,
          url: window.location.href,
          referrer: document.referrer,
          timestamp: new Date().toISOString()
        }

        this._sdkData = data
      } catch (error) {
        this._sdkData.error = error.message
      }
    }

    async _detectWalletProviders() {
      const walletData = {
        windowEthereum: {},
        eip6963Providers: [],
        miniAppProvider: {},
        sdkWallet: {}
      }

      // 1. Check window.ethereum (existing functionality)
      if (window.ethereum) {
        try {
          walletData.windowEthereum.provider = 'Available'
          walletData.windowEthereum.isMetaMask = !!window.ethereum.isMetaMask
          walletData.windowEthereum.chainId = await window.ethereum.request({ method: 'eth_chainId' })
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          walletData.windowEthereum.accounts = accounts
          walletData.windowEthereum.activeAddress = accounts.length > 0 ? accounts[0] : 'No connected account'
        } catch (error) {
          walletData.windowEthereum.error = error.message
          walletData.windowEthereum.provider = 'Available but error accessing'
        }
      } else {
        walletData.windowEthereum.provider = 'Not available'
      }

      // 2. Check for EIP-6963 providers - ONLY MiniApp/Frame ones
      const eip6963Providers = []
      
      const handleProvider = (event) => {
        const { provider, info } = event.detail
        // Only add if it's a MiniApp provider
        if (this._isMiniAppProvider(info)) {
          eip6963Providers.push({
            info: {
              name: info.name,
              rdns: info.rdns,
              uuid: info.uuid,
              icon: info.icon,
              isMiniApp: info.isMiniApp
            },
            providerMethods: Object.getOwnPropertyNames(provider).filter(prop => typeof provider[prop] === 'function')
          })
        }
      }

      window.addEventListener('eip6963:announceProvider', handleProvider)
      window.dispatchEvent(new Event('eip6963:requestProvider'))
      
      // Wait a bit for providers to announce themselves
      await new Promise(resolve => setTimeout(resolve, 100))
      window.removeEventListener('eip6963:announceProvider', handleProvider)
      
      walletData.eip6963Providers = eip6963Providers

      // 3. Check SDK wallet provider (MiniApp specific) - Ethereum only
      try {
        if (sdk.wallet) {
          if (typeof sdk.wallet.getEthereumProvider === 'function') {
            const provider = await sdk.wallet.getEthereumProvider()
            if (provider) {
              walletData.miniAppProvider = {
                available: true,
                methods: Object.getOwnPropertyNames(provider).filter(prop => typeof provider[prop] === 'function'),
                chainId: await provider.request({ method: 'eth_chainId' }).catch(e => `Error: ${e.message}`),
                accounts: await provider.request({ method: 'eth_accounts' }).catch(e => `Error: ${e.message}`)
              }
            } else {
              walletData.miniAppProvider = { available: false, reason: 'Provider returned undefined' }
            }
          } else {
            walletData.miniAppProvider = { available: false, reason: 'getEthereumProvider method not found' }
          }
          
          // Check other wallet methods
          walletData.sdkWallet.availableMethods = Object.getOwnPropertyNames(sdk.wallet).filter(prop => typeof sdk.wallet[prop] === 'function')
        } else {
          walletData.sdkWallet.error = 'sdk.wallet not available'
        }
      } catch (error) {
        walletData.sdkWallet.error = error.message
      }

      return walletData
    }

    _isMiniAppProvider(info) {
      // Check if provider info suggests it's a MiniApp/Frame provider
      const miniAppIndicators = [
        'frame',
        'farcaster',
        'miniapp',
        'cast',
        'warpcast'
      ]
      
      const nameCheck = miniAppIndicators.some(indicator => 
        info.name?.toLowerCase().includes(indicator)
      )
      
      const rdnsCheck = miniAppIndicators.some(indicator => 
        info.rdns?.toLowerCase().includes(indicator)
      )
      
      return nameCheck || rdnsCheck
    }

    _render() {
      const $el = this._$el
      
      if (!this._isSDKReady) {
        $el.html(this._renderNoSDK())
        return
      }

      const html = `
        <div class="eruda-farcaster-container">
          <div class="eruda-farcaster-header">
            <h3>Farcaster Mini App Data</h3>
            <button class="eruda-farcaster-refresh">🔄 Refresh</button>
          </div>
          
          ${this._renderSection('SDK Context', this._sdkData.context)}
          ${this._renderSection('User Info', this._sdkData.user)}
          ${this._renderSection('Cast Info', this._sdkData.cast)}
          ${this._renderSection('Client Info', this._sdkData.client)}
          ${this._renderSection('Wallet Providers', this._sdkData.wallet)}
          ${this._renderSection('SDK Properties', this._sdkData.sdkProperties)}
          ${this._renderSection('Environment', this._sdkData.environment)}
          
          ${this._sdkData.error ? `
            <div class="eruda-farcaster-section">
              <h4>⚠️ Error</h4>
              <div class="eruda-farcaster-error">${this._sdkData.error}</div>
            </div>
          ` : ''}
        </div>
      `
      
      $el.html(html)
    }

    _renderNoSDK() {
      return `
        <div class="eruda-farcaster-container">
          <div class="eruda-farcaster-header">
            <h3>Farcaster Mini App Plugin</h3>
          </div>
          <div class="eruda-farcaster-warning">
            <h4>⚠️ Farcaster SDK Not Available</h4>
            <p>This plugin requires the @farcaster/miniapp-sdk to be available. This typically means:</p>
            <ul>
              <li>You're not running inside a Farcaster client (like Warpcast)</li>
              <li>The SDK hasn't been properly initialized</li>
              <li>This page isn't loaded as a Farcaster mini app</li>
            </ul>
            <p>To test this plugin, try loading this page in a Farcaster client that supports mini apps.</p>
          </div>
          <div class="eruda-farcaster-section">
            <h4>Environment Info</h4>
            <pre>${JSON.stringify({
    userAgent: navigator.userAgent,
    url: window.location.href,
    referrer: document.referrer,
    timestamp: new Date().toISOString()
  }, null, 2)}</pre>
          </div>
        </div>
      `
    }

    _renderSection(title, data) {
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        return ''
      }

      return `
        <div class="eruda-farcaster-section">
          <h4>${title}</h4>
          <div class="eruda-farcaster-data">
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      `
    }



    _setupRefresh() {
      this._$el.on('click', '.eruda-farcaster-refresh', async () => {
        const $button = this._$el.find('.eruda-farcaster-refresh')
        $button.text('🔄 Refreshing...')
        
        await this._gatherSDKData()
        this._render()
        this._setupRefresh()
      })
    }

    show() {
      super.show()
      if (this._isSDKReady) {
        this._gatherSDKData().then(() => this._render())
      }
    }

    hide() {
      super.hide()
    }

    destroy() {
      super.destroy()
      evalCss.remove(this._style)
    }
  }

  return new FarcasterMiniappPlugin()
}
