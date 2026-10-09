// Stand-in for @netlify/identity on the server: whoever uses the local site is the one signed-in user.
export const LOCAL_USER = {
  id: "local-user",
  email: process.env.LOCAL_USER_EMAIL || "jonahquartey584@gmail.com",
  name: process.env.LOCAL_USER_NAME || "You",
};
export const getUser = async () => LOCAL_USER;

export const admin = { listUsers: async () => [{ ...LOCAL_USER, createdAt: new Date().toISOString() }] };
