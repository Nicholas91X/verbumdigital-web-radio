package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

// parseIntParam is a helper to get an int ID from a URL parameter
func parseIntParam(c *gin.Context, name string) (int, error) {
	val := c.Param(name)
	id, err := strconv.Atoi(val)
	if err != nil {
		return 0, err
	}
	return id, nil
}
