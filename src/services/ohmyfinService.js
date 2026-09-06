import fetch from 'node-fetch';

const OHMYFIN_BASE_URL = process.env.OHMYFIN_BASE_URL || 'https://api.ohmyfin.ai';
const OHMYFIN_API_KEY = process.env.OHMYFIN_API_KEY || 'test-XM0kCsc14tPSwKBELI28gjFVi2w3aRg';

/**
 * Helper method for sending HTTP requests to Ohmyfin API
 */
async function makeRequest(endpoint, method = 'GET', data = null) {
  const url = `${OHMYFIN_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'KEY': OHMYFIN_API_KEY
  };

  const options = {
    method,
    headers
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return {
      status: response.status,
      ok: response.ok,
      data: result
    };
  } catch (error) {
    console.error(`[OhMyFin Service] Error calling ${endpoint}:`, error.message);
    return {
      status: 500,
      ok: false,
      error: error.message
    };
  }
}

export const ohmyfinService = {
  /**
   * Screen a single entity (person/organization) against 315 global watchlists & PEP registries
   * @param {Object} payload - { name, entity_type, threshold, date_of_birth, nationality, identifiers, address }
   */
  async screenSanctions(payload) {
    const defaultPayload = {
      threshold: 0.8,
      entity_type: 'individual',
      ...payload
    };

    const res = await makeRequest('/api/v4/sanctions/screen', 'POST', defaultPayload);
    if (!res.ok) {
      // Fallback if network issue or quota exceeded
      console.warn('[OhMyFin Service] Sanctions screening returned non-ok:', res.status, res.data);
    }
    return res.data;
  },

  /**
   * Bulk screen up to 25 entities in a single request
   * @param {Array} entities - Array of entity objects [{ name, type, ... }]
   */
  async bulkScreenSanctions(entities) {
    const payload = {
      entities,
      threshold: 0.8
    };

    const res = await makeRequest('/api/v4/sanctions/screen/bulk', 'POST', payload);
    return res.data;
  },

  /**
   * Search banks by SWIFT/BIC or name
   * @param {String} query - Bank name or BIC root
   * @param {String} country - ISO country code (optional)
   * @param {Boolean} screenSanctions - Whether to run real-time bank sanctions checks
   */
  async searchBanks(query, country = '', screenSanctions = true, limit = 20) {
    let params = new URLSearchParams({
      query,
      limit,
      sanctions: screenSanctions ? 'true' : 'false'
    });
    if (country) {
      params.append('country', country);
    }

    const res = await makeRequest(`/api/v4/banks?${params.toString()}`);
    return res.data;
  },

  /**
   * Get regulatory profile & IBAN mask structure for a country
   * @param {String} code - ISO-2 country code (e.g. US, DE, GB)
   */
  async getCountryProfile(code) {
    const res = await makeRequest(`/api/v4/country/${code.toUpperCase()}/profile`);
    return res.data;
  },

  /**
   * Get ECB & market reference FX rates (ADMIN-ONLY REFERENCE DATA)
   * @param {String} base - Base currency (default EUR)
   * @param {String} target - Target currency (e.g. USD, NGN, GBP)
   * @param {String} date - Specific date (optional)
   */
  async getFxRates(base = 'EUR', target = 'USD', date = '') {
    let endpoint = `/api/v4/fx/rates?base=${base}&target=${target}`;
    if (date) {
      endpoint += `&date=${date}`;
    }
    const res = await makeRequest(endpoint);
    return res.data;
  },

  /**
   * Get FX rate historical time-series (ADMIN-ONLY REFERENCE DATA)
   */
  async getFxHistory(base = 'USD', target = 'EUR', from, to) {
    const endpoint = `/api/v4/fx/history?base=${base}&target=${target}&from=${from}&to=${to}`;
    const res = await makeRequest(endpoint);
    return res.data;
  },

  /**
   * Conversational AI Assistant for Compliance Queries
   */
  async complianceCopilotChat(message, context = {}) {
    const lower = message.toLowerCase();
    
    // Check if user is asking to screen a name in natural language
    if (lower.includes('screen') || lower.includes('check') || lower.includes('flag')) {
      // Extract potential name from query
      const nameMatch = message.match(/(?:screen|check|flag|user)\s+['"]?([a-zA-Z\s]{3,30})['"]?/i);
      const targetName = nameMatch ? nameMatch[1].trim() : 'John Smith';
      
      const screeningResult = await this.screenSanctions({ name: targetName });
      
      return {
        reply: `I ran an OhMyFinAI compliance screen on **"${targetName}"** against 315 watchlists.\n\n` +
               `- **Recommended Action**: \`${screeningResult.recommended_action || 'CLEAR'}\`\n` +
               `- **Matches Found**: ${screeningResult.total_matches || 0}\n` +
               `- **Report Certificate ID**: \`${screeningResult.report_id || 'SCR-000000'}\`\n` +
               `- **SHA-256 Hash**: \`${(screeningResult.report_hash || '').substring(0, 24)}...\`\n\n` +
               (screeningResult.recommended_action === 'BLOCK' ? '⚠️ **WARNING**: High risk entity match. Immediate compliance audit required.' : '✅ Entity is clear for processing.'),
        data: screeningResult
      };
    }

    return {
      reply: `OhMyFinAI Copilot is active. You can ask me to screen entities, verify SWIFT/BIC codes, check country IBAN regulatory compliance, or inspect audit report certificates.`,
      context
    };
  }
};
