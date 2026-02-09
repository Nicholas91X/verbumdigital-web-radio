package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

// parseUintParam is a helper to get a uint ID from a URL parameter
func parseUintParam(c *gin.Context, name string) (uint, error) {
	val := c.Param(name)
	id, err := strconv.ParseUint(val, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}
