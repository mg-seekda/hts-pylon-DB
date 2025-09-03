const axios = require('axios');

// CAS authentication middleware
const authMiddleware = (req, res, next) => {
  // Development bypass mode
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    req.user = {
      email: process.env.DEV_USER || 'dev@example.com',
      name: 'Development User',
      id: 'dev_user'
    };
    return next();
  }

  // Check for X-Remote-User header (injected by reverse proxy)
  const remoteUser = req.headers['x-remote-user'];
  
  if (!remoteUser) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'No authentication header found'
    });
  }

  // In production, the reverse proxy handles CAS validation
  // We just trust the X-Remote-User header
  req.user = {
    email: remoteUser,
    name: remoteUser.split('@')[0], // Use email prefix as name
    id: remoteUser
  };

  next();
};

// Optional: CAS ticket validation for direct API access
const validateCASTicket = async (ticket, service) => {
  try {
    const casValidateUrl = process.env.CAS_VALIDATE_URL;
    const response = await axios.get(casValidateUrl, {
      params: {
        ticket,
        service
      }
    });

    // Parse CAS response (simplified)
    const responseText = response.data;
    if (responseText.includes('<cas:authenticationSuccess>')) {
      const emailMatch = responseText.match(/<cas:user>(.*?)<\/cas:user>/);
      return emailMatch ? emailMatch[1] : null;
    }
    
    return null;
  } catch (error) {
    console.error('CAS validation error:', error);
    return null;
  }
};

module.exports = authMiddleware;
