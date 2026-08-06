/* ==========================================================
   EMERGENCE ACADEMY
   AUTH SERVICE
   Version: 1.0.0
========================================================== */

(function () {

    "use strict";

    class AuthService {

        static currentUser = null;

        static currentSession = null;

        static async login(email, password) {

            const client = await ApiService.getClient();

            const { data, error } =
                await client.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) {

                console.error(error);

                throw error;

            }

            this.currentUser = data.user;
            this.currentSession = data.session;

            return data.user;

        }

        static async signup(email, password, metadata = {}) {

            const client = await ApiService.getClient();

            const { data, error } =
                await client.auth.signUp({

                    email,

                    password,

                    options: {

                        data: metadata

                    }

                });

            if (error) {

                console.error(error);

                throw error;

            }

            this.currentUser = data.user;
            this.currentSession = data.session;

            return data.user;

        }

        static async logout() {

            const client = await ApiService.getClient();

            const { error } =
                await client.auth.signOut();

            if (error) {

                throw error;

            }

            this.currentUser = null;
            this.currentSession = null;

        }

        static async getUser() {

            const client = await ApiService.getClient();

            const { data, error } =
                await client.auth.getUser();

            if (error) {

                throw error;

            }

            this.currentUser = data.user;

            return data.user;

        }

        static async getSession() {

            const client = await ApiService.getClient();

            const { data, error } =
                await client.auth.getSession();

            if (error) {

                throw error;

            }

            this.currentSession = data.session;

            return data.session;

        }

        static async refreshSession() {

            return this.getSession();

        }

        static async resetPassword(email) {

            const client = await ApiService.getClient();

            const { error } =
                await client.auth.resetPasswordForEmail(email);

            if (error) {

                throw error;

            }

            return true;

        }

        static async updatePassword(password) {

            const client = await ApiService.getClient();

            const { error } =
                await client.auth.updateUser({

                    password

                });

            if (error) {

                throw error;

            }

            return true;

        }

        static async updateProfile(data) {

            const client = await ApiService.getClient();

            const { error } =
                await client.auth.updateUser({

                    data

                });

            if (error) {

                throw error;

            }

            return true;

        }

        static isAuthenticated() {

            return !!this.currentSession;

        }

    }

    window.AuthService = AuthService;

})();