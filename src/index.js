const {
  BaseKonnector,
  errors,
  // requestFactory,
  // signin,
  // scrape,
  // request,
  saveFiles,
  log
} = require('cozy-konnector-libs')

// Improvements
// Il faudrait pouvoir filer le jar à la fonction saveFiles pour le download des fichiers (saveFile)


var rp = require('request-promise').defaults({
  simple: false,
  // resolveWithFullResponse: true,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
  }
})


// var rp = requestFactory({
//   jar: true, // handle the cookies like a browser
//   cheerio: true, // automatically parse the result with [cheerio](https://github.com/cheeriojs/cheerio)
// })
var cookiejar = rp.jar()
// var options = {
//   jar: cookiejar // Tells rp to include cookies in jar that match uri
// }

const cheerio = require('cheerio')

// URLs
var login_url = 'https://www.matmut.fr/app/LoginRSP/espacesoc/Login/Index.mcp'
var authentication_url =
  'https://www.matmut.fr/app/loginrsp/login/index.mcp?returnurl=https%3A%2F%2Fwww.matmut.fr%2Fapp%2FSPAEspaceSocietaireInternet%2F%23!%2Faccueil'

module.exports = new BaseKonnector(start)

// The start function is run by the BaseKonnector instance only when it got all the account
// information (fields). When you run this connector yourself in "standalone" mode or "dev" mode,
// the account information come from ./konnector-dev-config.json file
async function start(fields) {
  log('info', 'Authenticating ...')
  var login = fields.login
  var password = fields.password

  await auth(rp, login, password).then(async () => {
    // await fetchContracts();
    await fetchCotisations()
  })

  // The BaseKonnector instance expects a Promise as return of the function
  // log('info', 'Fetching the contracts')
  // cheerio (https://cheerio.js.org/) uses the same api as jQuery (http://jquery.com/)
  // log('info', 'Parsing list of documents')
  // const documents = await parseDocuments($)

  // here we use the saveBills function even if what we fetch are not bills, but this is the most
  // common case in connectors
  log('info', 'Saving data to Cozy')
  // addData(documents, 'io.cozy.height')
  // await saveBills(documents, fields.folderPath, {
  // this is a bank identifier which will be used to link bills to bank operations. These
  // identifiers should be at least a word found in the title of a bank operation related to this
  // bill. It is not case sensitive.
  //   identifiers: ['books']
  // })
}

// Authentication function
async function auth(rp, login, password) {
  const auth_options = {
    method: 'GET',
    url: authentication_url,
    jar: cookiejar
  }
  await rp(auth_options)
    .then(async function(body) {
      const $ = cheerio.load(body)
      // Init the form
      const login_form = {
        Username: login,
        Password: password,
        ReturnUrl:
          'https://www.matmut.fr/app/SPAEspaceSocietaireInternet/#!/accueil',
        'MotDePasse.CodeFormulaire': 'Auth',
        __RequestVerificationToken: $(
          'input[name="__RequestVerificationToken"]'
        ).val()
      }
      // Second request to login
      const login_options = {
        method: 'POST',
        uri: login_url,
        form: login_form,
        jar: cookiejar,
        followAllRedirects: true
      }
      await rp(login_options).then(function(body) {
        const $ = cheerio.load(body)
        if ($('#infoSocMenu').html() !== null) {
          log('info', 'Connection successful')
          return true
          // return true
        } else {
          log('error', 'Invalid credentials')
          throw new Error(errors.LOGIN_FAILED)
        }
      })
    })
    .catch(function(err) {
      throw new Error(err)
    })
}

async function fetchContracts() {
  const contract_options = {
    uri: 'https://www.matmut.fr/app/WAContratsAttestations_1_0/api/contrat',
    method: 'GET',
    jar: cookiejar
  }
  await rp(contract_options).then(function(body) {
    // addData
    console.log(body)
  })
}

async function fetchCotisations() {
  const cotisation_options = {
    uri:
      'https://www.matmut.fr/app/WAEspaceSocietaire_1_0/api/compte/?isMiseEnDemeure=false',
    method: 'GET',
    jar: cookiejar,
    json: true
  }
  await rp(cotisation_options).then(function(body) {
    const cotis = cleanCotisations(body.Data.referencesReleves)
    saveFiles(cotis, '.')
  })
}

// Replace keys and delete unused keys
function cleanCotisations(cotisations) {
  const cleanedCotisations = []

  for (cotisation of cotisations) {
    cleanedCotisations.push({
      filename: cotisation.nom + '.pdf',
      fileurl: cotisation.urlPdf
    })
  }

  return cleanedCotisations
}
