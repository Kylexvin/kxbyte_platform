import prisma from '../../../../database/postgres/prisma.js';

const createUser = async (data) => {
  return prisma.user.create({ data });
};

const findUserByEmail = async (email) => {
  return prisma.user.findUnique({ where: { email } });
};

const findUserById = async (id) => {
  return prisma.user.findUnique({ where: { id } });
};

const updateUser = async (id, data) => {
  return prisma.user.update({ where: { id }, data });
};

const createSession = async (data) => {
  return prisma.session.create({ data });
};

const findSessionByToken = async (refreshToken) => {
  return prisma.session.findUnique({ where: { refreshToken } });
};

const deleteSession = async (id) => {
  return prisma.session.delete({ where: { id } });
};

const createVerificationToken = async (data) => {
  return prisma.verificationToken.create({ data });
};

const findVerificationToken = async (token) => {
  return prisma.verificationToken.findUnique({ where: { token } });
};

const deleteVerificationToken = async (id) => {
  return prisma.verificationToken.delete({ where: { id } });
};

const updateVerificationToken = async (id, data) => {
  return prisma.verificationToken.update({ where: { id }, data });
};

const deleteAllSessionsByUserId = async (userId) => {
  return prisma.session.deleteMany({ where: { userId } });
};

const findSessionsByUserId = async (userId) => {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};


export default {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  createSession,
  findSessionByToken,
  deleteSession,
  createVerificationToken,
  findVerificationToken,
  deleteVerificationToken,
  updateVerificationToken,
  deleteAllSessionsByUserId,
  findSessionsByUserId,
};