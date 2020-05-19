// src/humtum/Auth.js

// largely taken and slightly modified version of Auth0 Quickstart for React
export default class Auth {

    profile;
    authResult;



    storeAuthResult(res) {
        const currentAuth = {
            start: Date.now(),
            ...res
        }
        localStorage.humtumAuth = JSON.stringify(currentAuth)
    }

    getAccessToken = () => {
        return JSON.parse(localStorage.humtumAuth)["access_token"]
    }

    getIDToken = () => {
        return JSON.parse(localStorage.humtumAuth)["id_token"]
    }

    getRefreshToken = () => {
        return JSON.parse(localStorage.humtumAuth)["refresh_token"]
    }

    scheduleRenewal = (renewalfunc) => {
        const timeOut = JSON.parse(localStorage.humtumAuth).expires_in * 1000 - (Date.now() - JSON.parse(localStorage.humtumAuth).start)
        setTimeout(() => {
            renewalfunc()
        }, Math.max(timeOut, 0));
    }

    getProfile = (cb) => {
        if (this.profile) {
            cb(null, this.profile)
            return;
        }
        try {

            this.profile = this.getIDToken() && jwtDecode(this.getIDToken());
            cb(null, this.profile)
        } catch (e) {
            cb(e, this.profile)
        }
    }


    logout = (cb) => {
        localStorage.clear()
        this.profile = null
    }

    isAuthenticated = () => {
        try {
            JSON.parse(localStorage.humtumAuth);
        } catch (e) {
            return false;
        }
        return true;
    }

    isValid = () => {
        return JSON.parse(localStorage.humtumAuth).expires_in * 1000 - (Date.now() - JSON.parse(localStorage.humtumAuth).start) > 0
    }
}