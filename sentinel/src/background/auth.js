// src/humtum/Auth.js

// largely taken and slightly modified version of Auth0 Quickstart for React
export default class Auth {

    profile;
    authResult;



    static storeAuthResult(res) {
        const currentAuth = {
            start: Date.now(),
            ...res
        }
        return localStorage.humtumAuth = JSON.stringify(currentAuth)
    }

    getAccessToken = () => {
        return JSON.parse(localStorage.humtumAuth)["access_token"]
    }

    getIDToken = () => {
        return JSON.parse(localStorage.humtumAuth)["id_token"]
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
        localStorage.humtumAuth = null
        this.profile = null
    }

    isAuthenticated = () => {
        return localStorage.humtumAuth !== null
    }
}