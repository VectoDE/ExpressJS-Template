// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

// Replaces compression in the Worker bundle: Cloudflare compresses responses at the edge.
module.exports = () => (req, res, next) => next();
